# Security — Vulnerabilities & Concerns

> Last updated: 2026-02-28
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

### Session Token Storage
**Repos:** `admin_olive_and_ivory_gifts`
**Risk:** Admin sessions use httpOnly + secure cookies. The session token in D1 is stored as a SHA-256 hash — this is good. However, ensure the session table is indexed on `expires_at` and that expired sessions are cleaned up regularly.
**Recommendation:** Add a scheduled cron or cleanup query to purge expired sessions from D1.

### Stripe Error Messages Exposed
**Repos:** `olive_and_ivory_api`
**Risk:** Stripe error objects may be partially surfaced in API responses. Stripe errors can contain account-level metadata.
**Recommendation:** Catch Stripe errors, log them internally, and return a generic error message to the caller.

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

### No Rate Limiting on Admin Login
**Repos:** `admin_olive_and_ivory_gifts`
**Risk:** The `/api/auth/login` endpoint is rate limited at the middleware level (120 req/min for general API). This is relatively high for a login endpoint.
**Recommendation:** Apply a tighter rate limit (e.g., 10 attempts/min per IP) specifically on `/api/auth/login` to mitigate brute-force attacks.

### No Account Lockout Policy
**Repos:** `admin_olive_and_ivory_gifts`
**Risk:** There is no evidence of account lockout after repeated failed login attempts.
**Recommendation:** Implement a lockout or exponential backoff after N failed login attempts for the same user account.

---

## Security Strengths (Already Well Handled)

- HMAC-SHA256 with timing-safe comparison for server-to-server auth
- Stripe webhook signature validation via Stripe SDK (`constructEventAsync` + `SubtleCryptoProvider`)
- Stripe webhook replay protection: `stripe_event_id` checked against stored order value before UPDATE; duplicate events acknowledged without re-processing (REVIEW-002-001)
- Sensitive field redaction in all log sinks (passwords, tokens, API keys, secrets)
- Parameterised D1 queries (prevents SQL injection)
- HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff on all apps
- PBKDF2-SHA256 password hashing with 100,000 iterations and random salt
- Session tokens stored as hashes in D1 (not plaintext)
- httpOnly + secure cookies for admin sessions
- Per-IP rate limiting on all sensitive endpoints
- Separate rate limits (30 req/min) for AI, checkout, and Places endpoints
- Correlation IDs for complete request tracing across services

---

## Data Retention

### Current State

| Table | PII Stored | Current Retention |
|-------|-----------|-------------------|
| `orders` | Full name, email, phone, delivery address, gift message | Indefinite — no cleanup policy |
| `audit_logs` | Full order row in `after_json` (masked from REVIEW-001-010 onwards) | Indefinite |
| `event_logs` | IP address, customer email, correlation IDs | ~30 days (current practice) |

### Required Actions

- **REVIEW-001-010** (complete): `audit_logs.after_json` now redacts PII fields for order entities via `redactOrderPii()` in `writeAuditLog`.
- Define retention period for `orders`: suggested 7 years (ATO tax records requirement under ITAA 1997).
- Define retention period for `audit_logs`: suggested 90 days; truncate PII fields after expiry, retain row skeleton for audit trail continuity.
- Implement a D1 scheduled cleanup job or document a quarterly manual procedure.

### Australian Privacy Act (APP 11.2)

Under Australian Privacy Principles (APP 11.2), personal information no longer needed for its collected purpose must be destroyed or de-identified. The current indefinite retention of full customer PII in `orders` and `audit_logs` requires a formal retention decision and implementation before public launch.
