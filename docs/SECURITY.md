# Security — Vulnerabilities & Concerns

> Last updated: 2026-03-05
> Owner: repo agent / Yuri
> Scope: Vulnerability and security posture tracking

Severity levels: **Critical** / **High** / **Medium** / **Low**

---

## Critical

### CSRF Protection Missing on API Worker
**Repos:** `olive_and_ivory_api`
**Risk:** State-changing endpoints (POST, PUT, DELETE) rely entirely on HMAC signing. If the shared secret is ever compromised, there is no secondary CSRF defence.
**Recommendation:** Add CSRF tokens for admin session-authenticated routes. The HMAC signing is a strong control for server-to-server calls, but the admin site browser sessions should also use CSRF tokens for form submissions.

---

## High

### Incomplete XSS Input Sanitisation
**Repos:** `olive_and_ivory_api`
**Risk:** `hasSuspiciousInput()` only checks for `<script>` and `javascript:` substrings. This is easily bypassed with variants like `<img onerror=...>`, `<svg onload=...>`, or HTML-encoded payloads.
**Recommendation:** Use a proper HTML sanitisation library (e.g., DOMPurify on the client, or a well-tested server-side sanitiser). For data stored in D1 and rendered in the frontend, ensure the Next.js frontend always uses React's JSX (which auto-escapes), and never uses `dangerouslySetInnerHTML` with unsanitised API data.

### HMAC Nonce Replay Prevention — RESOLVED (v0.1.2)
**Repos:** `olive_and_ivory_api`, `api-middleware`
**Status:** Implemented in api-middleware v0.1.2. `withAuthHmac` now inserts the nonce into `api_nonces` (PRIMARY KEY acts as atomic uniqueness guard). A UNIQUE constraint violation is returned as 401. Expired nonces (older than tolerance window) are purged per-request. Opt-out via `replay_protection: false` in AuthHmacConfig.

### Undocumented Route HMAC Bypass on API Worker — RESOLVED (2026-03-03)
**Repos:** `olive_and_ivory_api`
**Status:** The API worker no longer skips HMAC authentication merely because a route is missing from `API_ROUTE_REGISTRY`. The auth skip path now applies only to explicitly public routes, and `POST /api/orders/:id/refund` is registered as an HMAC-protected endpoint. This closes the review finding that left the refund route unintentionally public (REVIEW-004-001).

### OpenAI Prompt Injection
**Repos:** `olive_and_ivory_api`, `admin_olive_and_ivory_gifts`
**Risk:** Collection names and descriptions entered by admins are interpolated into OpenAI prompts. A malicious or careless admin could craft input that manipulates the AI output (e.g., jailbreaks, data exfiltration prompts).
**Recommendation:**
- Add prompt length limits before sending to OpenAI (currently 24,000 chars is allowed in schema but not enforced pre-send)
- Consider separating user-provided data from prompt instructions using clear delimiters
- Validate AI output against the expected schema before accepting it

### PII in Event Logs
**Repos:** `olive_and_ivory_api`, `admin_olive_and_ivory_gifts`
**Risk:** Event logs store customer IP addresses, email addresses, and potentially order details for 30 days. Under Australian Privacy Act 1988 and comparable regulations, this constitutes PII storage requiring a privacy policy, disclosure, and potentially consent.
**Recommendation:**
- Review what PII is stored in `event_logs` and `audit_logs`
- Implement pseudonymisation (hash IPs) where full IP is not required
- Ensure the retention period (30 days) is justified and disclosed
- Add a privacy policy page to the storefront if not already present

---

## Medium

### CSRF Secondary Token Not Implemented — Admin
**Repos:** `admin_olive_and_ivory_gifts`
**Status (2026-03-05):** The unused `sessions.csrf_token` column and write path were removed (REVIEW-003-011), eliminating dead security plumbing.
**Residual risk:** Admin state-changing requests still rely on `sameSite: 'lax'` cookie behaviour and session checks only; there is no explicit CSRF header/token validation layer.
**Recommendation:** Implement explicit CSRF validation for admin browser mutations (`X-CSRF-Token` or equivalent double-submit pattern) if threat model requires defence-in-depth beyond SameSite.

### R2 Assets — No Access Control
**Repos:** `olive_and_ivory_api`
**Risk:** Product images are stored in a public R2 bucket. If image keys follow a predictable pattern, private or unpublished product images could be accessed by guessing keys.
**Recommendation:**
- Use UUID-based or cryptographically random image keys (verify this is already the case)
- For sensitive images (e.g., draft/unpublished products), consider using R2 signed URLs with a short TTL rather than public bucket access

### Admin Password Security
**Repos:** `admin_olive_and_ivory_gifts`
**Risk:** Passwords are hashed with PBKDF2-SHA256 (100,000 iterations), which is acceptable but not optimal. bcrypt, scrypt, or Argon2id are more memory-hard and better suited to password hashing.
**Recommendation:** PBKDF2 at 100,000 iterations is adequate for now, but consider migrating to Argon2id on next password change cycle. Also enforce a minimum password length and complexity policy.
**Current hardening (REVIEW-003, 2026-03-03):**
- `verifyPassword` uses constant-time XOR comparison (`constantTimeEqual`) to prevent timing side-channels — REVIEW-003-004
- `email` capped at 254 chars, `password` at 1024 chars before any DB or PBKDF2 operation — REVIEW-003-003
- `request.json()` wrapped in try/catch; non-string fields rejected at parse time — REVIEW-003-002
- `verifyPassword` returns `false` (not throws) if `password_hash` is null in DB — REVIEW-003-005

### Session Token Storage
**Repos:** `admin_olive_and_ivory_gifts`
**Risk:** Admin sessions use httpOnly + secure cookies. The session token in D1 is stored as a SHA-256 hash — this is good. However, ensure the session table is indexed on `expires_at` and that expired sessions are cleaned up regularly.
**Recommendation:** Add a scheduled cron or cleanup query to purge expired sessions from D1.
**Update (REVIEW-003-006, 2026-03-03):** `createSession` now throws on D1 `execute()` failure; the login handler catches this and returns 503 without setting the session cookie. Previously a DB failure silently issued an unvalidatable token.

### Stripe Error Messages Exposed — RESOLVED (2026-03-05)
**Repos:** `olive_and_ivory_api`
**Status:** Checkout session failure parsing now extracts structured Stripe context (`message`, `code`, `type`, upstream request ID) instead of collapsing errors to low-signal strings such as `[object Object]` (REVIEW-005-002).
**Recommendation:** Keep responses caller-safe while preserving structured failure context in internal logs.

### Stripe Refund Reconciliation Depends On `order_refunds` Migration Deployment
**Repos:** `olive_and_ivory_api`
**Risk:** The refund route now uses deterministic Stripe idempotency keys and an `order_refunds` ledger for replay-safe local reconciliation. Until migration `0013_order_refunds_ledger.sql` is applied in D1, the route falls back to direct `orders.refunded_cents` updates and returns a warning when it cannot record the refund ledger row.
**Recommendation:** Apply migration `0013_order_refunds_ledger.sql` in every environment before using admin refunds in production. Treat refund responses containing a `warning` field as requiring operator verification.

### Google Places Cache Poisoning
**Repos:** `olive_and_ivory_api`, `olive_and_ivory_gifts`
**Risk:** The in-memory Places autocomplete cache uses the input string as the cache key. A flood of unique (but slightly varied) queries could exhaust memory. Also, since the cache is per-isolate (in-memory), it does not persist across Cloudflare Worker restarts.
**Recommendation:** Consider using KV or D1 for persistent rate limiting and caching of Places results, with a TTL-based eviction. Validate and normalise cache keys.

### OpenAI API Key Exposure Risk
**Repos:** `olive_and_ivory_api`
**Risk:** The `OPENAI_API_KEY` is a Worker secret. If it's accidentally logged (e.g., dumped via error metadata), it would be exposed in D1 logs.
**Recommendation:** Confirm `redactSensitive()` from `api-middleware` covers `openai_api_key` and related key names. Add a test to verify redaction of AI-related secrets.

---

## Low

### Debug Endpoints Accessible in Production
**Repos:** `olive_and_ivory_api`
**Risk:** Endpoints like `/health/secrets` (confirms secret presence), `/log-test`, `/stripe/test-event`, `/stripe/test-checkout`, and `/system/routes-docs` are accessible in production. While they don't expose secret values, they provide an attacker with environment and route enumeration.
**Recommendation:** Gate debug/test endpoints behind an environment check or an internal auth mechanism. At minimum, `/stripe/test-*` and `/log-test` should be disabled in production.

### CORS — Confirm Allowed Origins Match Production
**Repos:** `olive_and_ivory_api`
**Risk:** CORS allowed origins are hardcoded to `https://oliveandivorygifts.com` and `https://admin.oliveandivorygifts.com`. Verify these match exactly and that there is no wildcard or overly broad match.
**Recommendation:** Periodically audit the CORS config to ensure it has not drifted.

### Content Security Policy — Admin Site
**Repos:** `admin_olive_and_ivory_gifts`
**Risk:** The admin CSP allows inline styles (required by Tailwind CSS). This weakens the XSS protection of the CSP.
**Recommendation:** Where possible, use nonce-based CSP to allow specific inline styles rather than a blanket inline-styles permission.

### No Rate Limiting on Admin Login — RESOLVED (2026-03-03)
**Repos:** `admin_olive_and_ivory_gifts`
**Resolution:** In-handler rate limiter added to `POST /api/auth/login`: 10 attempts per 60s per IP, in-memory sliding-window Map, 429 with `Retry-After` on breach, excess attempts logged as `event_type: 'security'`. The middleware matcher intentionally excludes `api/auth/*` from middleware processing; the in-handler limiter covers the login endpoint directly. (REVIEW-003-001)

### No Account Lockout Policy
**Repos:** `admin_olive_and_ivory_gifts`
**Risk:** There is no evidence of account lockout after repeated failed login attempts.
**Recommendation:** Implement a lockout or exponential backoff after N failed login attempts for the same user account.

---

## Security Strengths (Already Well Handled)

- HMAC-SHA256 with timing-safe comparison for server-to-server auth
- API worker HMAC auth is now default-deny for undocumented routes; only explicit public routes bypass verification (REVIEW-004-001)
- Stripe webhook signature validation via Stripe SDK (`constructEventAsync` + `SubtleCryptoProvider`)
- Stripe webhook replay protection: `stripe_event_id` checked against stored order value before UPDATE; duplicate events acknowledged without re-processing (REVIEW-002-001)
- Stripe refunds use deterministic idempotency keys and a dedicated `order_refunds` ledger (migration `0013`) to avoid duplicate local application on retries (REVIEW-004-002/003)
- Sensitive field redaction in all log sinks (passwords, tokens, API keys, secrets)
- Parameterised D1 queries (prevents SQL injection)
- HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff on all apps
- PBKDF2-SHA256 password hashing with 100,000 iterations and random salt
- Session tokens stored as hashes in D1 (not plaintext)
- httpOnly + secure cookies for admin sessions
- Per-IP rate limiting on all sensitive endpoints including admin login (10/min, in-handler) — REVIEW-003-001
- Constant-time password hash comparison in admin `verifyPassword` — REVIEW-003-004
- Separate rate limits (30 req/min) for AI, checkout, and Places endpoints
- Correlation IDs for complete request tracing across services

---

## Data Retention

### Current State

| Table | PII Stored | Current Retention |
|-------|-----------|-------------------|
| `orders` | Full name, email, phone, delivery address, gift message | 7 years (financial/tax record baseline) |
| `audit_logs` | Full order row in `after_json` (masked from REVIEW-001-010 onwards) | 90 days |
| `event_logs` | IP address, customer email, correlation IDs | ~30 days (current practice) |

### Retention Policy (Adopted)

- **REVIEW-001-010** (complete): `audit_logs.after_json` now redacts PII fields for order entities via `redactOrderPii()` in `writeAuditLog`.
- `orders`: retain for 7 years to satisfy financial/tax record retention baseline.
- `audit_logs`: retain for 90 days for operational security/audit investigations.
- `event_logs`: retain approximately 30 days for operational diagnostics.

### Enforcement Procedure (Manual, Quarterly)

Until a scheduled D1 cleanup worker is introduced, retention is enforced manually (quarterly) using the SQL runbook in `docs/MAINTENANCE_CHECKLIST.md`:

1. Purge `audit_logs` rows older than 90 days.
2. Purge `event_logs` rows older than 30 days.
3. Delete `orders` older than 7 years only after finance confirms no legal hold.

### Australian Privacy Act (APP 11.2)

Under Australian Privacy Principles (APP 11.2), personal information no longer needed for its collected purpose must be destroyed or de-identified. The current indefinite retention of full customer PII in `orders` and `audit_logs` requires a formal retention decision and implementation before public launch.
