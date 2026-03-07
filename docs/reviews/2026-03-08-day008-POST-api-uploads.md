# Deep-Dive Review — Day 008

**Date:** 2026-03-08
**Target type:** Route
**Target:** POST /api/uploads
**Primary file:** admin_olive_and_ivory_gifts/src/app/api/uploads/route.ts (281 LOC)
**Reviewer:** repo agent / Yuri
**Status:** Complete

---

## Target Summary

The `POST /api/uploads` route is an admin-specific endpoint for uploading files, primarily hero
images for collections, directly into the Cloudflare R2 bucket. It handles multipart form-data,
enforces file size and MIME-type restrictions, and performs a direct update to the D1 `collections`
table if a `collection_id` is provided in the payload.

---

## A. Usage Mapping

### A1. Entry Points

| Caller | Repo | Runtime | Method | Trust Level |
|--------|------|---------|--------|-------------|
| Admin UI (Media Form) | `admin_olive_and_ivory_gifts` | Edge (Next.js) | POST | High* |

*(Note: Auth is currently superficial; see Security section stringency.)*

### A2. Import / Reference Map

| Symbol | File | Line | Purpose |
|--------|------|------|---------|
| `requireBindings` | `src/lib/bindings.ts` | 2 | Access D1 and R2 bucket bindings |
| `logEvent` | `src/lib/logging.ts` | 3 | Write audit logs |
| `getRequestContextInfo` | `src/lib/api-logging.ts` | 4 | Extract correlation ID, user, and IP |
| `withApiLogging` | `src/lib/api-logging.ts` | 6 | Middleware pipeline execution |

### A3. Call Graph (abbreviated)

```
Browser -- POST /api/uploads --> Next Middleware (Session present check)
Next Middleware --> POSTHandler
POSTHandler --> R2_put[env.BUCKET.put]
POSTHandler --> D1_update[UPDATE collections]
POSTHandler --> AuditLog[logEvent]
```

### A4. Data Flow Summary

The route receives a `multipart/form-data` payload containing a file buffer, and optional metadata
strings (`collection_id`, `prefix`, `crop_preset`). It checks that the file size is under
`MAX_UPLOAD_BYTES` and that the client-supplied `file.type` matches `ALLOWED_IMAGE_MIME`. If
validation passes, it constructs an R2 key (incorporating `collection_id` or `prefix`) and writes
the file to the bucket. If a `collection_id` exists, it updates the corresponding row in D1
`collections` using a dynamically introspected columns list. Success or failure is logged via
`event_logs`.

### A5. Trust Boundaries Crossed

1. Public Internet / Cloudflare Access → Admin Pages API.
2. Admin Pages API → D1 Database (Write).
3. Admin Pages API → R2 Bucket (Write).

---

## B. Database and Data Flow

### B1. D1 Tables Accessed

| Table | Operation | Fields Read | Fields Written | Notes |
|-------|-----------|-------------|----------------|-------|
| `collections` | PRAGMA info | `name` columns | None | Schema introspection |
| `collections` | UPDATE | None | `hero_image_key`, `hero_image_url`, `updated_at` | Only if `collection_id` is supplied |

### B2. Transactions and Atomicity

Writes are not atomic across storage mediums. The R2 upload occurs first on line 176. If the
subsequent D1 update on line 200 fails (e.g., locking issue or syntax error), the exception is
swallowed (line 203) and the route returns success. This leaves an orphaned image in R2 and a
collection silently missing its hero image update.

### B3. External APIs Touched

None.

### B4. R2 / KV / Cache Usage

Writes incoming buffers directly to `env.BUCKET` (R2) using `put()`.

### B5. Legacy Schema Observations

The route relies on a `PRAGMA table_info` call to determine if `hero_image_key` and `hero_image_url`
exist before writing them.

### B6. Index and Performance Observations

Introspecting the `collections` table schema via `PRAGMA` queries on every upload adds an
unnecessary D1 roundtrip. The schema should be known to the application.

---

## C. Security Review

### C1. Authentication

**CRITICAL:** The route does not validate the cryptographic session token in `oi_admin_session`. The
Next.js middleware only checks that the cookie is _present_; it does not connect to the database to
call `auth.validateSession()`. The API route handler (`route.ts`) also lacks this validation. Unless
stopped upstream by Cloudflare Access, any visitor can forge `oi_admin_session=any_value` and
execute uploads, or modify metadata via `PUT /api/items/[id]`.

### C2. Authorisation

Due to the lack of session validation, there is no enforcement of admin roles for uploading or
modifying collection records.

### C3. Input Validation

- **File size:** Handled correctly. Rejects sizes over `MAX_UPLOAD_BYTES`.
- **Mime Type:** Validates based purely on the client-supplied `file.type` header constraint check.
- **Extensions:** The code extracts the extension from the client-supplied filename and applies a
  sanitization: `.replace(/[^a-z0-9]/g, "")`. This sanitization permits dangerous alphanumeric
  extensions (like `.php`, `.exe`, `.html`, `.svg`).

### C4. Injection Risks

- **Path / Key Traversal in R2:** The route constructs the R2 key as
  `${keyPrefix}/${Date.now()}-${safeBase}.${ext}` where `keyPrefix` relies on either `collectionId`
  or `prefix`. Both strings are user-controlled and are not sanitized against `../` path traversal
  injections.
- **SQL Injection:** Safe. `collection_id` is correctly parameterised in the
  `env.DB.prepare().bind()` update statement.

### C5. SSRF / Open Redirect

None.

### C6. Webhook Abuse

N/A.

### C7. Rate Limiting

The route is subject to the `middleware.ts` global API rate limit of 120 API requests per IP per
minute.

### C8. PII Handling

No customer PII is involved in hero image uploads. Event logging captures the executor's IP and
email (if provided by CF access).

### C9. Secrets Handling

R2 Public URL is dynamically loaded from D1 settings; no hardcoded secrets in the route.

### C10. Edge / Runtime Exposure

Executes safely on the edge.

### C11. Multi-Tenant Leakage

N/A.

### C12. Abuse Vectors

1. **Authentication Bypass & Vandalism:** Setting a spoofed `oi_admin_session` cookie to upload
   explicit files and overwrite production hero images arbitrarily.
2. **Storage Exhaustion:** Attacker uploads thousands of 9MB files (bypassing normal auth checks)
   leading to excessive R2 billing.
3. **Cross-Site Scripting (XSS) via SVG/HTML:** Uploading a malicious SVG or HTML file named
   `exploit.svg` with `Content-Type: image/jpeg` spoofed to bypass validation. Since it is hosted on
   `r2PublicBaseUrl`, it could be used for stored XSS.

---

## D. Observability and Operations

### D1. Logging Completeness

Audit logging is extremely detailed. `event_logs` tracks failures and successful updates, including
bytes, MIME strings, and completion times.

### D2. Error Handling

D1 Database failures are silent (try/catch swallows them on line 203) leading to unrecorded failures
when linking the hero image, giving a false positive 'OK' response.

### D3. Retry Logic

None implemented.

### D4. Performance Hotspots

- D1 PRAGMA table introspection block synchronously stops route flow. 
- A 10MB file buffer extraction `await file.arrayBuffer()` could add significant memory load to the
  isolate concurrent limit.

### D5. Failure Scenarios

- **R2 down/unavailable:** Standard 500 return cleanly.
- **D1 down/unavailable:** Request succeeds, but the `collection` ignores the update. File is
  orphaned.

---

## E. Documentation Gaps

### E1. Architecture Doc Updates Required

N/A.

### E2. Security Doc Updates Required

N/A.

### E3. Database Doc Updates Required

N/A.

---

## F. 500 LOC Assessment

**Primary file LOC:** 281
**Violation:** No

Within limits.

---

## G. Improvement Backlog

| ID | Priority | Title | Effort | Owner | Acceptance Criteria | Risk |
|----|----------|-------|--------|-------|---------------------|------|
| RVW-008-001 | P0 | [SECURITY-CRITICAL] Cryptographically validate admin session cookie for API routes | M | — | Admin API rejects spoofed sessions | Breaking admin login paths if incorrectly deployed |
| RVW-008-002 | P1 | Sanitize `prefix` and `collection_id` to prevent R2 path traversal | S | — | Strings are cleaned of `/` and `.` | R2 key formatting regression |
| RVW-008-003 | P1 | Strict extension allowlist mapped to MIME types | S | — | Extensions like `.php` or `.svg` are explicitly rejected | None |
| RVW-008-004 | P2 | Remove PRAGMA introspection from `/api/uploads` and hardcode schema | S | — | PRAGMA statement is removed, queries use static DB design | None |
| RVW-008-005 | P2 | Implement async compensation rollback for R2 uploads on D1 failure | M | — | If D1 fails to link image, bucket item is deleted | None |

*Escalation note on P0:* A critical missing credential check allowing full unauthenticated bypass of
all Next.js admin API endpoints was found. The Next.js middleware only checks that the token string
is physically present on the cookie, and `/api/uploads` never verifies its cryptographic validity
before executing D1 and R2 writes. Immediate mitigation is needed. Tracked in `TASKS.md` [SECURITY-
CRITICAL].

---

## H. Definition of Done — This Review

- [x] All sections A–G completed
- [x] All P0 findings have an immediate action or escalation note
- [x] Tasks added to docs/TASKS.md
- [x] Relevant documentation sections updated or update tasks created
- [x] Review record committed to docs/reviews/
