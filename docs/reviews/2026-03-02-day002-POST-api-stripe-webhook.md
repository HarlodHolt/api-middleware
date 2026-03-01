# Deep-Dive Review — Day 002

**Date:** 2026-03-02
**Target type:** Route
**Target:** `POST /api/stripe/webhook` — Stripe webhook event processing and order payment state update
**Primary file:** `olive_and_ivory_api/src/index.ts` (2,549 LOC — **VIOLATION**)
**Reviewer:** —
**Status:** Complete

---

## Target Summary

`POST /api/stripe/webhook` receives signed webhook events from Stripe, verifies the `Stripe-Signature` header using the SDK's `constructEventAsync`, extracts an order ID from the event metadata, and updates the matching `orders` row in D1 with payment state (`paid`, `failed`). It is the sole mechanism by which Stripe payment confirmation reaches the platform.

The route is registered at both `/stripe/webhook` and `/api/stripe/webhook`. The handler is defined in `src/index.ts` rather than `coreRoutes.ts`, making it distinct from the rest of the business logic.

---

## A. Usage Mapping

### A1. Entry Points

| Caller | Repo | Runtime | Method | Trust Level |
|--------|------|---------|--------|-------------|
| Stripe platform (production webhooks) | External | Stripe infrastructure | POST | Public internet — verified via `Stripe-Signature` HMAC-SHA256 |
| Stripe CLI / test dashboard | External | Developer machine | POST | Test mode, same signature verification |

### A2. Import / Reference Map

| Symbol | File | Lines | Purpose |
|--------|------|-------|---------|
| `handleStripeWebhook` | `src/index.ts` | 2313–2416 | Main handler |
| `eventOrderId()` | `src/index.ts` | 2287–2297 | Extracts order ID from event metadata or `client_reference_id` |
| `getOrderColumns()` | `src/index.ts` | 2299–2302 | Per-call PRAGMA introspection for schema-adaptive UPDATE |
| `addSetClauseIfColumn()` | `src/index.ts` | 2304–2311 | Conditionally appends SET clauses |
| `logStripeRoute()` | `src/index.ts` | ~41–77 | Structured event logging for Stripe routes |
| `getStripeClient()` | (shared) | — | Returns memoised Stripe SDK client |
| `Stripe.createSubtleCryptoProvider()` | stripe | — | Edge-safe Web Crypto for signature verification |

### A3. Call Graph (abbreviated)

```
Stripe platform
  └── POST /api/stripe/webhook  (src/index.ts:2417-2418)
        ├── stripe.webhooks.constructEventAsync()   [signature verification]
        ├── eventOrderId()                          [metadata extraction]
        ├── getOrderColumns()                       [PRAGMA table_info(orders)]
        └── DB.prepare(UPDATE orders ...).run()     [single D1 write]
              └── logStripeRoute()                  [event_logs D1 write]
```

### A4. Data Flow Summary

Stripe signs and POSTs a JSON event body. The handler reads the raw body as text (required for signature verification), extracts the `Stripe-Signature` header, and constructs a verified `Stripe.Event` object. It then extracts the internal order ID from `event.data.object.metadata.order_id` (with `client_reference_id` as fallback). If an order ID is found, it builds a schema-adaptive UPDATE statement and writes payment state to the `orders` table. The response `{ received: true }` is always returned to Stripe on success so Stripe does not retry.

### A5. Trust Boundaries Crossed

| From | To | Mechanism | Trust established by |
|------|----|-----------|----------------------|
| Stripe platform | API Worker (`/api/stripe/webhook`) | HTTPS POST | `Stripe-Signature` HMAC-SHA256 verified by `constructEventAsync` |
| API Worker handler | D1 (`orders` table) | D1 binding | Worker-side binding |
| API Worker handler | D1 (`event_logs` table) | D1 binding | Worker-side binding |

---

## B. Database and Data Flow

### B1. D1 Tables Accessed

| Table | Operation | Fields Read | Fields Written | Notes |
|-------|-----------|-------------|----------------|-------|
| `orders` | UPDATE | — | `payment_provider`, `updated_at`, `stripe_event_id`, `payment_status`, `status`, `paid_at` (conditional) | Schema-adaptive; only writes columns that exist |
| `event_logs` | INSERT | — | Full structured log row | Via `logStripeRoute()` → `logEvent()` |

### B2. Transactions and Atomicity

No transaction. A single bare `UPDATE orders SET ... WHERE id = ?` is executed. There is no batch(), BEGIN, or COMMIT. If the UPDATE succeeds but the `logStripeRoute` write fails, the order is updated but the log is lost — acceptable. If the UPDATE itself fails, a 500 is returned to Stripe and Stripe will retry.

### B3. External APIs Touched

| Service | Endpoint | Auth Method | Idempotency | Failure Handling |
|---------|----------|-------------|-------------|------------------|
| Stripe SDK | `webhooks.constructEventAsync` | `STRIPE_WEBHOOK_SECRET` | N/A (local crypto) | Exception caught → 400 |

No outbound `fetch()` calls from the webhook handler. No email, CRM, or notification calls on payment confirmation.

### B4. R2 / KV / Cache Usage

None.

### B5. Legacy Schema Observations

`getOrderColumns()` issues a `PRAGMA table_info(orders)` on every webhook call. This is the same per-request schema introspection tracked in REVIEW-001-008 (module-level schema cache task). The webhook is lower-traffic than order creation but the same pattern applies.

### B6. Index and Performance Observations

- `PRAGMA table_info(orders)` on every call — same pattern as Day 001 finding, existing backlog task covers it.
- Single UPDATE by primary key (`id`) — efficient.
- No N+1 patterns.

---

## C. Security Review

### C1. Authentication

Stripe `Stripe-Signature` HMAC-SHA256 verified via `stripe.webhooks.constructEventAsync()` using `STRIPE_WEBHOOK_SECRET` from env. Uses `Stripe.createSubtleCryptoProvider()` for edge-safe Web Crypto. Missing or invalid signature → 400, logged. Both secrets checked for presence before use (line 2323).

**Assessment: sound.** No bypass conditions detected.

### C2. Authorisation

No admin auth required — the route is intentionally public. Authentication is provided entirely by the Stripe signature. The only authorisation decision is "is this a valid Stripe event?".

### C3. Input Validation

| Field | Source | Validated? | Risk |
|-------|--------|-----------|------|
| `Stripe-Signature` header | HTTP header | Yes — missing → 400 | — |
| Event body (raw) | HTTP body | Yes — via SDK signature check | — |
| `event.type` | Stripe event | Only: empty string → 400 | Unknown types still process (see C12) |
| `event.id` | Stripe event | Coerced to String | — |
| `event.data.object.metadata.order_id` | Stripe metadata | No bounds check, coerced to String | Arbitrary order ID injection if metadata is tampered — prevented by signature |
| `event.data.object.amount_total` | Stripe event | Logged only; **not compared to `orders.total_cents`** | **See finding REVIEW-002-002** |

### C4. Injection Risks

- **SQL injection**: No. UPDATE uses parameterised bindings via `db.prepare().bind()`.
- **Prompt injection**: Not applicable.
- **Command injection**: Not applicable.

### C5. SSRF / Open Redirect

None. No outbound `fetch()` calls. No redirect.

### C6. Webhook Abuse

**Signature verification**: implemented correctly — `constructEventAsync` with `Stripe.createSubtleCryptoProvider()`.

**Replay protection**: **not implemented.** `stripe_event_id` is written to the `orders` row but is never read back to check for prior processing. Stripe retries (on 5xx or network error) or any duplicate delivery will re-execute the UPDATE, overwriting `paid_at` with a later timestamp. For `checkout.session.completed`, this means the paid timestamp drifts on each retry.

**Event type allowlisting**: no explicit allowlist. Unknown event types pass signature verification and still write `payment_provider`, `updated_at`, and `stripe_event_id` to the matched order row.

**Assessment: replay protection is the primary gap. See REVIEW-002-001.**

### C7. Rate Limiting

The global `withRateLimit({ window_seconds: 60, limit: 60 })` middleware from `api-middleware` applies to all routes including this one. Stripe may retry a webhook up to 3 times within a short window (and up to 14 days total). If a batch of events arrives during a high-traffic period, Stripe retries could be rate-limited (429), causing Stripe to back off and retry later — degrading payment confirmation latency. The webhook is not exempt from the global limit.

**Risk level: low** — Stripe handles 429 gracefully with exponential backoff. Not a data integrity issue.

### C8. PII Handling

The webhook does not log customer PII from the Stripe event. Only these fields from `event.data.object` are extracted for logging:
- `session_id`, `payment_status`, `amount_total` (financial metadata, not customer PII)
- `order_id` (internal UUID)

Customer email, name, phone, address present in Stripe event objects are ignored.

**Assessment: safe.**

### C9. Secrets Handling

- `STRIPE_WEBHOOK_SECRET` read from `c.env` (Cloudflare Workers binding) — not logged, not returned in responses.
- `STRIPE_SECRET_KEY` read from `c.env` — used only for SDK client instantiation.
- Both checked for presence before use (line 2323).

### C10. Edge / Runtime Exposure

Handler uses `Stripe.createSubtleCryptoProvider()` — edge-safe Web Crypto. No Node.js-only APIs. Cloudflare Workers compatible.

### C11. Multi-Tenant Leakage

Single-tenant platform. No cross-tenant risk.

### C12. Abuse Vectors

1. **Replay via Stripe retry**: Stripe retries a `checkout.session.completed` event after a transient 5xx. UPDATE fires again, `paid_at` overwritten. No double-charge (Stripe prevents that) but `paid_at` timestamp is inaccurate.
2. **Unknown event type write**: An attacker who can register a custom Stripe event type (not possible in practice — events are Stripe-defined and signature-protected) would still write metadata fields. Not exploitable in practice.
3. **Missing order ID in metadata**: If order creation bug omits `order_id` from Stripe metadata, webhook silently succeeds (200) with no order update. No error logged at warning level.

---

## D. Observability and Operations

### D1. Logging Completeness

`logStripeRoute()` fires on every code path including all error branches. Logs include: `route`, `request_id`, `stripe_event_id`, `status`, `event_type`, `event_created`, `session_id`, `session_payment_status`, `session_amount_total`, `order_id`, `order_updated`. Correlation ID and request ID propagated.

**Gap**: when `orderId` is empty (metadata missing), handler still returns 200 but the success log entry does not flag this as an anomaly. Should be logged at `warn` level.

### D2. Error Handling

All failure paths are caught and return structured JSON with correlation ID. Stripe always gets a definitive response (4xx or 5xx = Stripe retries; 200 = Stripe considers event delivered).

Silent path: `if (orderId)` block is skipped silently when `orderId` is empty. Success log records `order_id: null` but at `info` level — hard to alert on.

### D3. Retry Logic

No retry within the handler (appropriate for a webhook receiver). Stripe provides the retry layer externally.

### D4. Performance Hotspots

- `PRAGMA table_info(orders)` per call (same as Day 001 finding — existing task tracks module-level cache).
- Otherwise: one D1 SELECT (after fix) + one D1 UPDATE + one D1 log insert. Acceptable.

### D5. Failure Scenarios

| Scenario | Outcome |
|----------|---------|
| Stripe signature invalid | 400 returned, logged, Stripe does not retry |
| D1 unavailable | 500 returned, Stripe retries |
| Order ID not in metadata | 200 returned, order not updated — **silent degradation** |
| UPDATE finds 0 rows (order deleted) | 200 returned, `order_updated: false` logged |
| `logStripeRoute()` throws | Unhandled — would bubble to Cloudflare as a 500 |

---

## E. Documentation Gaps

### E1. Architecture Doc Updates Required

None required for this review.

### E2. Security Doc Updates Required

Add note: `POST /api/stripe/webhook` has no replay deduplication. Stripe event IDs are stored in `orders.stripe_event_id` but not read pre-update. After fix (REVIEW-002-001), update SECURITY.md to reflect replay protection added.

### E3. Database Doc Updates Required

Confirm `orders.stripe_event_id` column is documented in DATABASE_DESIGN.md. Column is present (written by handler) but should be included in the `orders` table glossary.

---

## F. 500 LOC Assessment

**Primary file LOC:** 2,549
**Violation:** Yes

`src/index.ts` is 2,549 lines — a 5× violation. It mixes:
- App bootstrap and middleware setup
- Stripe webhook handling (lines 2287–2418)
- Stripe test-event simulation (lines 2420+)
- Health routes (elsewhere in file)
- Log/metrics routes

This file is tracked as a separate backlog task (medium priority — "Split `index.ts` into focused modules").

### Split Plan (if applicable)

Existing task in TASKS.md covers this. Stripe webhook specifically should move to `src/routes/stripe.ts` alongside the test-event handler. No new task created — existing task reference: "Split `index.ts` into focused modules".

---

## G. Improvement Backlog

| ID | Priority | Title | Effort | Owner | Acceptance Criteria | Risk |
|----|----------|-------|--------|-------|---------------------|------|
| REVIEW-002-001 | P1 | Add idempotency check for stripe_event_id before UPDATE | S | — | SELECT existing stripe_event_id before update; if already matches eventId return 200 without re-processing; log at info level | Low — adds one SELECT per webhook call |
| REVIEW-002-002 | P1 | Validate Stripe amount_total against orders.total_cents | S | — | After SELECT (from REVIEW-002-001), compare event amount_total to stored total_cents; log warn if mismatch; continue processing | Low — amount mismatch is logged, not rejected, to avoid blocking legitimate edge cases |
| REVIEW-002-003 | P2 | Log warning when orderId cannot be extracted from event | S | — | When orderId is empty after verified event, log at warn level with event_type and event_id | None |
| REVIEW-002-004 | P2 | Add explicit event type allowlist | S | — | Define `HANDLED_EVENT_TYPES` set; unknown types return 200 without writing to orders | Low |
| REVIEW-002-005 | P2 | Exempt webhook path from global rate limit (or raise limit) | S | — | Stripe webhook paths added to rate-limit bypass list or limit raised to 300/min for those paths | Low |

---

## H. Definition of Done — This Review

- [x] All sections A–G completed
- [x] P0 findings: none identified
- [x] P1 findings: REVIEW-002-001 and REVIEW-002-002 fixed in this session (single SELECT added before UPDATE)
- [x] P2 tasks added to docs/TASKS.md
- [x] docs/reviews/README.md updated
- [x] Review record committed to docs/reviews/
