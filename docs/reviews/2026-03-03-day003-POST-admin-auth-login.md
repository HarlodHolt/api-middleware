# Deep-Dive Review — Day 003

**Date:** 2026-03-03
**Target type:** Route
**Target:** `POST /api/auth/login` — admin session creation via password credentials
**Primary file:** `admin_olive_and_ivory_gifts/src/app/api/auth/login/route.ts` (124 LOC)
**Supporting files reviewed:** `src/lib/auth.ts` (173 LOC), `src/middleware.ts` (118 LOC), `src/lib/db.ts` (50 LOC), `src/app/api/auth/logout/route.ts`, `src/app/api/auth/me/route.ts`, `src/app/api/auth/access-session/route.ts`, `src/app/api/auth/bootstrap/route.ts`
**Reviewer:** —
**Status:** Complete

---

## Target Summary

`POST /api/auth/login` is the primary admin credential authentication endpoint. It accepts `{ email, password }`, looks up the user in D1, verifies the password against a PBKDF2-SHA256 hash, creates a session row, and sets an `httpOnly` session cookie. A Cloudflare Access parallel path (`/api/auth/access-session`) can bypass credential login entirely when the CF Access email header is present. This route is the sole entry point that creates admin sessions without a pre-existing Cloudflare Access identity.

---

## A. Usage Mapping

### A1. Entry Points

| Caller | Repo | Runtime | Method | Trust Level |
|--------|------|---------|--------|-------------|
| Admin login page (`/login`) | admin_olive_and_ivory_gifts | Browser | POST | Public internet — unauthenticated |
| Automated scripts / external tool | External | Any | POST | Public internet — unauthenticated |

### A2. Import / Reference Map

| Symbol | File | Lines | Purpose |
|--------|------|-------|---------|
| `Auth` | `src/lib/auth.ts` | 18–173 | Password hashing, session creation, session validation |
| `SESSION_COOKIE_NAME` | `src/lib/auth.ts` | 4 | Constant `'oi_admin_session'` |
| `DB` | `src/lib/db.ts` | 9–50 | D1 query/execute wrapper |
| `getRequestId` | `src/lib/logging.ts` | 176–179 | Extracts `cf-ray` or `x-request-id` |
| `logEvent` | `src/lib/logging.ts` | 181–275 | Structured event log write to D1 `event_logs` |
| `withApiLogging` | `src/lib/api-logging.ts` | — | Wraps handler with timing/logging middleware |
| `getRequestContext` | `@cloudflare/next-on-pages` | — | Returns Cloudflare env bindings |

### A3. Call Graph (abbreviated)

```
Browser POST /api/auth/login
  └── POSTHandler (route.ts:9)
        ├── getRequestContext()              [env bindings]
        ├── new Auth(env)                   [auth.ts]
        │     └── new DB(env)               [db.ts]
        ├── request.json()                  [parse body — UNCAUGHT throw risk]
        ├── auth.db.query(SELECT * FROM users WHERE email = ?)
        ├── auth.hashPassword('dummy')      [timing equaliser on user-not-found]
        ├── auth.verifyPassword(password, user.password_hash)
        │     └── auth.hashPassword(password, saltHex)
        │           └── crypto.subtle.deriveBits(PBKDF2, SHA-256, 100000 iters)
        ├── auth.createSession(user.id)
        │     └── DB.execute(INSERT INTO sessions ...)
        └── logEvent(env, ...)              [D1 write to event_logs]
```

### A4. Data Flow Summary

Browser submits `{ email, password }` as JSON. The handler reads the body without a try/catch. It queries the `users` table by email (case-sensitive `=` operator). If no user is found, a dummy PBKDF2 hash is computed to partially equalise timing. If the user exists, `verifyPassword` re-derives the PBKDF2 hash from the submitted password using the stored salt and compares the hex strings. On match, `createSession` INSERTs a new row into `sessions` with a SHA-256-hashed token. The raw token (not the hash) is written into the `httpOnly` session cookie. On every code path, `logEvent` writes a structured record to `event_logs`.

### A5. Trust Boundaries Crossed

| From | To | Mechanism | Trust established by |
|------|----|-----------|----------------------|
| Public internet | Admin edge worker | HTTPS | None — unauthenticated endpoint |
| Edge worker | D1 (users table) | D1 binding | Cloudflare binding — internal only |
| Edge worker | D1 (sessions table) | D1 binding | Cloudflare binding — internal only |
| Edge worker | D1 (event_logs table) | D1 binding | Cloudflare binding — internal only |

---

## B. Database and Data Flow

### B1. D1 Tables Accessed

| Table | Operation | Fields Read | Fields Written | Notes |
|-------|-----------|-------------|----------------|-------|
| `users` | SELECT | `*` (all columns) | — | Should be scoped to required fields only |
| `sessions` | INSERT | — | `id, user_id, session_token_hash, csrf_token, expires_at, created_at, last_seen_at` | No session limit per user; no cleanup of prior sessions |
| `event_logs` | INSERT | — | 20 fields | Audit trail; falls back to shorter schema on failure |

### B2. Transactions and Atomicity

Session creation is a single INSERT. There is no transaction wrapping session creation + login audit log. If the audit log write fails, the session was already created. `DB.execute()` catches all errors and returns `false` silently — if the `sessions` INSERT fails, the caller receives `true` (success) from `auth.createSession` returning normally, but no session row exists. The cookie is then set with a token that will never validate.

### B3. External APIs Touched

None. This route is entirely local to D1.

### B4. R2 / KV / Cache Usage

None.

### B5. Legacy Schema Observations

The `sessions` table stores a `csrf_token` column. This token is generated on every session creation (`auth.ts:108`) but is never read or validated anywhere in the reviewed codebase. It is entirely unused, representing unimplemented CSRF protection.

### B6. Index and Performance Observations

- `users` lookup is `WHERE email = ?`. If the `users` table has no index on `email`, this is a full scan. For a single-digit user table this is negligible, but an index on `email` is correct practice.
- `sessions` lookup in `validateSession` is `WHERE session_token_hash = ?`. An index on `session_token_hash` is required for sub-linear lookups as the sessions table grows.
- No index audit was performed; these are inferred assumptions.

---

## C. Security Review

### C1. Authentication

This endpoint is the authentication boundary — it requires no prior authentication. It is reachable by any public HTTP client. The middleware matcher (`middleware.ts:5`) explicitly excludes `api/auth` from all middleware processing, including rate limiting.

### C2. Authorisation

Not applicable to the login route itself. Admin-only access is enforced by middleware on all other routes.

### C3. Input Validation

| Field | Validated | Issue |
|-------|-----------|-------|
| `email` | Presence only (`!email`) | No format validation, no length limit |
| `password` | Presence only (`!password`) | **No length limit** — PBKDF2 with 100,000 iterations will process any length; a multi-megabyte password creates a CPU DoS vector |
| Body JSON parse | None | `request.json()` is called without try/catch; a malformed body throws an unhandled exception |
| `email` type | None | `{ email?: string }` cast is a TypeScript annotation only; a non-string value (e.g. `email: 123`) is accepted at runtime |

### C4. Injection Risks

`auth.db.query('SELECT * FROM users WHERE email = ?', email)` is parameterised — no SQL injection risk. Password is never interpolated into SQL. No template injection.

### C5. SSRF / Open Redirect

None. No outbound fetches. `access-session` has `returnTo` validation via `safeReturnTo()` which is correctly implemented.

### C6. Webhook Abuse

Not applicable to this route.

### C7. Rate Limiting

**FINDING — P0:** The middleware matcher (`middleware.ts:5`) is:
```
/((?!api/auth|_next/static|_next/image|favicon.ico|login|api/health).*)
```
This excludes ALL `api/auth/*` routes from middleware processing. As a result:
- **No rate limiting applies to `POST /api/auth/login`**
- An attacker can make unlimited login attempts with no throttling
- The in-memory `apiRateBucket` in `middleware.ts` is never consulted for this path

The login endpoint has no per-IP or per-email throttle, no lockout, and no CAPTCHA. Full credential stuffing and brute force are viable against any known email address.

### C8. PII Handling

- Email and user ID are logged on every login attempt (success and failure).
- IP address is captured and logged from `cf-connecting-ip`.
- Passwords are never logged — `logging.ts` includes `"password"` in `SENSITIVE_KEYS`.
- On success, `user.email` is written to `event_logs.user_email` — acceptable for audit purposes.
- `event_logs` retention is capped at `MAX_EVENT_LOG_ROWS = 10,000` rows (rolling).

### C9. Secrets Handling

- `password_hash` is retrieved from D1 but never returned to the caller.
- The raw session token is placed in the cookie; only its SHA-256 hash is stored in D1. This is correct — token exposure does not reveal the DB-stored hash.
- `ADMIN_BOOTSTRAP_TOKEN` env var is compared in bootstrap route; not accessed in login route.

### C10. Edge / Runtime Exposure

`export const runtime = 'edge'` — all Web Crypto API calls (`crypto.subtle.deriveBits`, `crypto.randomUUID`, `crypto.getRandomValues`) are edge-safe. No Node.js APIs used.

### C11. Multi-Tenant Leakage

Single-tenant admin. No customer data is accessed in this route.

### C12. Abuse Vectors

| Vector | Current State | Risk |
|--------|---------------|------|
| Credential stuffing | No rate limiting, no lockout | **Critical** |
| PBKDF2 CPU exhaustion via long password | No length limit on `password` field | High — 1MB password × 100k iterations per request |
| JSON body bomb | `request.json()` uncaught | Worker throws 500 on malformed body |
| Username enumeration via timing | Partial mitigation: dummy hash on user-not-found, but comparison is not constant-time | Residual risk |
| Session fixation | New session always created on login; old sessions not invalidated | Low — old sessions remain valid but attacker cannot predict new token |
| CSRF against admin actions | CSRF token in sessions table never validated; `sameSite: 'lax'` is the only protection | Medium — exploitable in cross-site POST if browser sameSite not enforced |

---

## D. Observability and Operations

### D1. Logging Completeness

Login success and all failure paths are logged to `event_logs` with: `request_id`, `correlation_id`, `ip_address`, `user_email`, `user_id`, `status_code`, `reason`. Correlation IDs are freshly generated per request rather than propagated from upstream — no upstream caller sets `x-correlation-id` on the login request. This is acceptable.

Logout (`/api/auth/logout`) has **no audit log** — session deletion is silent. This is a gap; a logout event should be recorded.

### D2. Error Handling

- `request.json()` is not wrapped in try/catch. A `Content-Type: text/plain` body or truncated JSON will cause an unhandled rejection, likely resulting in a 500 from the edge runtime.
- `auth.verifyPassword(password, user.password_hash)`: if `user.password_hash` is `null` (possible if a DB row exists without a hash), `storedHash.split(':')` throws a `TypeError`. This case is not guarded.
- `DB.execute()` catches all errors and returns `false` silently. `createSession` does not check this return value — a failed INSERT produces no error to the handler.

### D3. Retry Logic

Not applicable. Login is a user-initiated action; no automatic retry.

### D4. Performance Hotspots

- PBKDF2 with 100,000 iterations and SHA-256 is the primary CPU cost. On an edge isolate, this is expected (~10–50ms).
- No length guard on the password field means arbitrarily long inputs are hashed in full before being rejected. Worst case: an adversary submits 1MB passwords to tie up the isolate.
- Two D1 writes per login (session INSERT + event_log INSERT) are sequential, not batched.

### D5. Failure Scenarios

| Failure | Current behaviour |
|---------|------------------|
| D1 unreachable | `DB.execute()` returns `false`; session INSERT silently fails; cookie set with token that never validates; no error returned to caller |
| D1 `event_logs` INSERT fails | Caught silently; no impact on login success |
| `request.json()` parse error | Unhandled exception; edge runtime returns 500 |
| `user.password_hash` is null in DB | `verifyPassword` throws `TypeError: Cannot read properties of null`; unhandled; 500 |

---

## E. Documentation Gaps

### E1. Architecture Doc Updates Required

None — the admin auth flow is not currently described in `docs/ARCHITECTURE.md` at the session layer. A brief note on the dual-path auth (password login vs Cloudflare Access bootstrap) would improve onboarding clarity. Logging a task rather than updating inline.

### E2. Security Doc Updates Required

`docs/SECURITY.md` should note:
- The login endpoint has no rate limiting (P0 finding).
- CSRF protection relies solely on `sameSite: 'lax'`; the stored CSRF token is unimplemented.
- Session tokens are hashed with SHA-256 before DB storage.

### E3. Database Doc Updates Required

If `docs/DATABASE_DESIGN.md` documents the `sessions` table, the `csrf_token` column should be noted as currently unused pending implementation.

---

## F. 500 LOC Assessment

**Primary file LOC:** 124
**Violation:** No

`auth.ts` (173 LOC) and `middleware.ts` (118 LOC) are also within limits. No split plan required.

---

## G. Improvement Backlog

| ID | Priority | Title | Effort | Owner | Acceptance Criteria | Risk |
|----|----------|-------|--------|-------|---------------------|------|
| REVIEW-003-001 | P0 | Add rate limiting to `/api/auth/login` | S | — | Login endpoint subject to per-IP rate limit (e.g. 10 attempts/min); middleware matcher updated or dedicated in-handler limit added; 429 returned with `Retry-After`; excess attempts logged | Middleware matcher change could break login page redirect flow if not tested |
| REVIEW-003-002 | P1 | Guard `request.json()` in login handler | S | — | Body parse wrapped in try/catch; malformed JSON returns 400 with structured error body; no unhandled 500 | None |
| REVIEW-003-003 | P1 | Add input length limits on `email` and `password` | S | — | `email` capped at 254 chars (RFC 5321); `password` capped at 1024 chars; values exceeding limits return 400 before any DB or PBKDF2 operation | None |
| REVIEW-003-004 | P1 | Use constant-time comparison in `verifyPassword` | S | — | String comparison replaced with `crypto.subtle.timingSafeEqual` or equivalent; existing tests still pass | Edge-safe: `crypto.subtle` is available in Workers |
| REVIEW-003-005 | P1 | Guard against null `password_hash` in `verifyPassword` | S | — | `verifyPassword` returns `false` (not throws) when `storedHash` is falsy; login handler returns 401 | None |
| REVIEW-003-006 | P1 | Surface `DB.execute()` failure in `createSession` | S | — | `DB.execute()` rethrows on INSERT failure OR returns `false` and `createSession` throws; login handler catches and returns 503; session cookie is NOT set on DB failure | Risk: changes DB contract — audit all callers of `DB.execute()` |
| REVIEW-003-007 | P2 | Replace `SELECT *` with explicit columns in user lookup | S | — | Login query uses `SELECT id, email, role, password_hash FROM users WHERE email = ?`; same change applied to `access-session` route | None |
| REVIEW-003-008 | P2 | Normalise email comparison to lowercase consistently | S | — | Login route lowercases email before query (matching `access-session` behaviour); D1 query uses `WHERE LOWER(email) = LOWER(?)`; email validation added | None |
| REVIEW-003-009 | P2 | Add audit log to logout route | S | — | `POST /api/auth/logout` logs `auth.logout` event with user_id, session token hash prefix (first 8 chars), IP | None |
| REVIEW-003-010 | P2 | Remove or env-gate `debug` fields from `/api/auth/me` response | S | — | `me` response removes `debug.has_access_header` and `debug.access_email` from production responses, or gates them behind an `env.DEBUG_MODE` flag | None |
| REVIEW-003-011 | P2 | Implement or remove CSRF token validation | M | — | Either: validate `csrf_token` from sessions table on all state-changing admin API calls; or: remove `csrf_token` column and generation if not planned. Document decision | M-effort if implementing validation across all admin routes |

---

## H. Definition of Done — This Review

- [x] All sections A–G completed
- [x] P0 finding (REVIEW-003-001: no login rate limiting) has task created in `docs/TASKS.md`
- [x] All P1/P2 improvement tasks added to `docs/TASKS.md`
- [x] `docs/SECURITY.md` — rate limit resolved, constant-time compare noted, session DB-failure fix noted, CSRF gap added as Medium, Security Strengths updated
- [x] `docs/ARCHITECTURE.md` — Admin Authentication section added: dual-path auth flows, session lifecycle, middleware coverage
- [x] `docs/DATABASE_DESIGN.md` — `users` and `sessions` tables added to domain overview, ERD, and table notes
- [x] Review record committed to `docs/reviews/`
