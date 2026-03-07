# Deep-Dive Review — Day 004

**Date:** 2026-03-03
**Target type:** Route
**Target:** `POST /api/orders/:id/refund` — admin-triggered Stripe refund execution for an existing paid order
**Primary file:** `olive_and_ivory_api/src/routes/coreRoutes.ts` (4,566 LOC — **VIOLATION**)
**Reviewer:** Codex
**Status:** Complete

---

## Target Summary

`POST /api/orders/:id/refund` issues a Stripe refund against the payment reference stored on an `orders` row, then writes the refunded amount back to D1 and emits audit logs. It is the only route in the current codebase that initiates outbound money movement after payment capture.

The route is mounted at both `/orders/:id/refund` and `/api/orders/:id/refund`. It is called from the admin Next.js app via a local proxy route, but the API worker route itself is not present in the API route registry.

---

## A. Usage Mapping

### A1. Entry Points

| Caller | Repo | Runtime | Method | Trust Level |
|--------|------|---------|--------|-------------|
| Admin orders list refund modal | `admin_olive_and_ivory_gifts` | Next.js Edge Route + browser UI | POST | Admin browser intent proxied through signed server route |
| Admin order detail refund modal | `admin_olive_and_ivory_gifts` | Next.js Edge Route + browser UI | POST | Admin browser intent proxied through signed server route |
| Direct caller to API worker | External | Public internet | POST | **Actual current state: unauthenticated due missing route registry entry** |

### A2. Import / Reference Map

| Symbol | File | Lines | Purpose |
|--------|------|-------|---------|
| `refundOrderHandler` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | 4037–4133 | Main refund route handler |
| `stripeGetPaymentIntentId()` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | 4018–4035 | Resolves `payment_reference` into a Stripe Payment Intent ID |
| `app.post("/api/orders/:id/refund", ...)` | `olive_and_ivory_api/src/routes/coreRoutes.ts` | 4135–4136 | Route registration |
| `POST` | `admin_olive_and_ivory_gifts/src/app/api/orders/[id]/refund/route.ts` | 8–27 | Admin proxy route that signs and forwards the refund request |
| `handleRefund()` | `admin_olive_and_ivory_gifts/src/app/(dashboard)/orders/page.tsx` | 586–595 | Orders list refund action |
| `handleRefund()` | `admin_olive_and_ivory_gifts/src/app/(dashboard)/orders/[id]/client.tsx` | 295–303 | Order detail refund action |
| `withAuthHmac()` skip rule | `olive_and_ivory_api/src/index.ts` | 138–147 | Skips HMAC auth when `findRouteDoc(path)` returns null |
| `findRouteDoc()` | `olive_and_ivory_api/src/lib/apiRouteRegistry.ts` | 77–86 | Route-registry lookup used by the auth skip rule |

### A3. Call Graph (abbreviated)

```text
Admin UI
  -> admin Next.js /api/orders/:id/refund
      -> proxySigned()
          -> POST /api/orders/:id/refund   [API worker]
              -> SELECT * FROM orders WHERE id = ?
              -> stripeGetPaymentIntentId()
                  -> GET https://api.stripe.com/v1/checkout/sessions/:id?expand[]=payment_intent
              -> POST https://api.stripe.com/v1/refunds
              -> UPDATE orders SET refunded_cents = ...
              -> logAction() -> event_logs
              -> writeAuditLog() -> audit_logs
```

### A4. Data Flow Summary

The admin UI posts `{ amount_cents?, reason? }` to a local Next.js route, which forwards the payload to the API worker. The worker loads the order by ID, validates that `payment_status === "paid"`, computes a `maxRefundable` amount from `total_cents - refunded_cents`, resolves the stored `payment_reference` to a Stripe Payment Intent, and calls Stripe's refunds API. On success, it increments `orders.refunded_cents`, reloads the order, writes an audit/event log, and returns the Stripe refund ID and amount.

Two trust decisions are made before money moves: whether the caller is allowed to hit the route, and whether the requested amount is within remaining refundable balance. The current implementation is weak on both: the route is unintentionally unauthenticated, and the refundable balance check is not concurrency-safe.

### A5. Trust Boundaries Crossed

| From | To | Mechanism | Trust established by |
|------|----|-----------|----------------------|
| Admin browser | Admin Next.js route | Same-origin fetch + session context | Admin app auth layer (outside this handler) |
| Admin Next.js route | API worker | HMAC-signed proxy request | Intended: `withAuthHmac()` |
| Public internet | API worker | Direct HTTPS POST | **Actual: accepted if route is undocumented and therefore skipped by auth middleware** |
| API worker | Stripe API | Bearer secret key | `STRIPE_SECRET_KEY` |
| API worker | D1 (`orders`, `event_logs`, `audit_logs`) | Worker bindings | Worker-side binding |

---

## B. Database and Data Flow

### B1. D1 Tables Accessed

| Table | Operation | Fields Read | Fields Written | Notes |
|-------|-----------|-------------|----------------|-------|
| `orders` | SELECT | `id`, `payment_status`, `payment_reference`, `refunded_cents`, `total_cents`, plus full row via `SELECT *` | `refunded_cents`, `updated_at` | Update is derived from a stale pre-Stripe read |
| `event_logs` | INSERT | — | Structured refund success log only | No logging on validation or Stripe failure branches |
| `audit_logs` | INSERT | — | Before/after order snapshots | Failure bubbles into the outer catch |

### B2. Transactions and Atomicity

No transaction boundary spans the route. The critical sequence is:

1. Read `orders` row
2. Call Stripe refund API (external irreversible side effect)
3. Update `orders.refunded_cents`
4. Write logs

If step 2 succeeds and step 3 or 4 throws, the handler returns a 500 even though money has already moved. That makes client retries dangerous.

### B3. External APIs Touched

| Service | Endpoint | Auth Method | Idempotency | Failure Handling |
|---------|----------|-------------|-------------|------------------|
| Stripe | `GET /v1/checkout/sessions/:id?expand[]=payment_intent` | Bearer `STRIPE_SECRET_KEY` | N/A | Non-2xx -> 502 |
| Stripe | `POST /v1/refunds` | Bearer `STRIPE_SECRET_KEY` | **None** | Non-2xx -> 502 |

### B4. R2 / KV / Cache Usage

None.

### B5. Legacy Schema Observations

The route is schema-adaptive only for `refunded_cents`; if that column is absent, Stripe refunds still execute but no local refund total is stored. There is no dedicated refund ledger table, so reconciliation depends on Stripe and on the single aggregate `orders.refunded_cents` column when present.

### B6. Index and Performance Observations

- Order lookup is by primary key and is efficient.
- The handler performs two reads of the same `orders` row (`SELECT *` before and after refund).
- The dominant latency is Stripe network I/O.

---

## C. Security Review

### C1. Authentication

**Primary finding: broken by omission.**

The worker middleware intends to require HMAC on non-public routes (`olive_and_ivory_api/src/index.ts:138–147`), but the skip rule explicitly returns `true` when `findRouteDoc(path)` returns null. `POST /api/orders/:id/refund` is not present in `API_ROUTE_REGISTRY` (`olive_and_ivory_api/src/lib/apiRouteRegistry.ts:43–44` list `/api/orders` and `/api/orders/:id`, but not the refund child path), so `findRouteDoc()` returns null and HMAC verification is skipped entirely.

Result: the refund route currently accepts direct unauthenticated internet traffic. Because it only needs a valid paid order ID and the worker's Stripe secret is used server-side, this is a direct money-movement exposure.

### C2. Authorisation

There is no in-handler authorisation check beyond "order is paid". Even if HMAC enforcement is restored, the current API worker model only distinguishes "signed" vs "public"; it does not distinguish storefront callers from admin-only refund callers. The immediate defect is the auth bypass above; the broader design still leaves refund as a coarse HMAC-protected mutation rather than an explicitly admin-scoped capability.

### C3. Input Validation

| Field | Source | Validated? | Risk |
|-------|--------|-----------|------|
| `id` | URL path | Only presence via route match | No format validation; relies on parameterised SQL |
| `amount_cents` | Request body | Rounded; must be `1..maxRefundable` when provided | Bound check is race-prone under concurrency |
| `reason` | Request body | Any truthy string accepted | Not size-limited; only toggles Stripe reason enum |
| `payment_reference` | DB | Must be non-empty | No validation that it matches expected Stripe object shape |

### C4. Injection Risks

- **SQL injection:** no, D1 queries are parameterised.
- **Command injection:** not applicable.
- **Prompt injection:** not applicable.

### C5. SSRF / Open Redirect

None. Stripe endpoints are hard-coded.

### C6. Webhook Abuse

Not applicable. This is an outbound mutation route, not a webhook receiver.

### C7. Rate Limiting

The global `withRateLimit({ window_seconds: 60, limit: 60 })` middleware applies because only webhook paths are exempt. This caps brute-force attempts, but it is not a substitute for authentication and does not protect against low-rate targeted refund abuse.

### C8. PII Handling

The handler reads the full order row via `SELECT *`, and `writeAuditLog()` stores before/after snapshots with order PII redaction. The route itself returns only refund metadata, not customer fields.

### C9. Secrets Handling

`STRIPE_SECRET_KEY` is read from the worker environment, never returned, and used only for Stripe API calls. This part is sound.

### C10. Edge / Runtime Exposure

Uses `fetch()` and `URLSearchParams`, both Worker-safe. No Node-only API dependency.

### C11. Multi-Tenant Leakage

Single-tenant platform. No tenant boundary exists.

### C12. Abuse Vectors

1. **Unauthenticated refund execution:** missing route registry entry causes auth bypass, exposing a public money-movement endpoint.
2. **Duplicate refunds on retry:** `POST /v1/refunds` is sent without an `Idempotency-Key`, so client retries after ambiguous failures can create multiple refunds.
3. **Refund after partial success:** if Stripe succeeds but D1/logging fails, the handler returns 500 from the outer catch and invites retry, compounding the duplicate-refund risk.
4. **Concurrent partial refunds corrupt local state:** `refunded_cents` is updated from a stale `alreadyRefunded` snapshot, so concurrent successful refunds can understate the local refunded total.

---

## D. Observability and Operations

### D1. Logging Completeness

Only the success path logs `orders.refund`. All early validation failures (`not_paid`, `no_payment_reference`, `invalid_amount`) and Stripe upstream failures return structured JSON but emit no event log. That leaves no audit trail for attempted refund abuse or operator mistakes unless the outer platform logs raw HTTP responses.

### D2. Error Handling

Pre-Stripe failures return appropriate 4xx/5xx JSON responses. Post-Stripe failures are handled incorrectly: any exception after the refund API returns success is converted into a generic 500 (`orders_refund_failed`), even though the refund may already be irreversible in Stripe.

### D3. Retry Logic

No internal retry logic exists, which is appropriate for a payment mutation. The problem is the lack of idempotency and the false-negative 500s after successful Stripe mutation.

### D4. Performance Hotspots

Stripe network round trips dominate latency. No material CPU hotspot in the handler itself.

### D5. Failure Scenarios

| Scenario | Outcome |
|----------|---------|
| Unauthenticated caller hits route | **Currently succeeds into business logic** because HMAC is skipped |
| Invalid amount requested | 400 returned, no event log written |
| Stripe session lookup fails | 502 returned, no event log written |
| Stripe refund succeeds, D1 update fails | 500 returned after money moved; client may retry |
| Two partial refunds race | Stripe may accept both, but local `refunded_cents` can be wrong |

---

## E. Documentation Gaps

### E1. Architecture Doc Updates Required

No immediate `docs/ARCHITECTURE.md` change is required for the normal request flow. If REVIEW-004-001 is implemented by changing the default auth posture for undocumented routes, `docs/ARCHITECTURE.md` should explicitly state that undocumented API worker routes are denied by default.

### E2. Security Doc Updates Required

After the auth-bypass fix lands, `docs/SECURITY.md` should record the invariant that API route documentation/registration is security-critical because it drives middleware auth classification. The current review record is the canonical record of the present defect.

### E3. Database Doc Updates Required

If REVIEW-004-002 introduces a refund ledger table or persists Stripe refund IDs on `orders`, `docs/DATABASE_DESIGN.md` should be updated to document that reconciliation source of truth. No schema doc change is needed yet because the current schema does not expose dedicated refund records.

---

## F. 500 LOC Assessment

**Primary file LOC:** 4,566
**Violation:** Yes

This target lives inside the existing `coreRoutes.ts` monolith. The split plan already captured in Day 001 still applies: this route belongs in a dedicated `orders.ts` module, with Stripe-specific helpers (`stripeGetPaymentIntentId`) extracted into an orders/stripe helper module. No duplicate split task is added here because `REVIEW-001-015` already tracks the file breakup.

---

## G. Improvement Backlog

| ID | Priority | Title | Effort | Owner | Acceptance Criteria | Risk |
|----|----------|-------|--------|-------|---------------------|------|
| REVIEW-004-001 | P0 | Default-deny undocumented routes and register refund endpoint | S | — | `API_ROUTE_REGISTRY` includes `POST /api/orders/:id/refund`; `withAuthHmac` no longer skips authentication merely because a route lacks registry metadata; unsigned requests to `/api/orders/:id/refund` return 401 in automated coverage | Tightening default auth may expose other undocumented routes that were silently relying on the current bypass |
| REVIEW-004-002 | P0 | Add idempotent refund execution and stop surfacing post-Stripe false 500s | M | — | Stripe refund call sends a deterministic `Idempotency-Key`; once Stripe confirms success, downstream log/audit failures do not cause a retry-inviting 500; refund IDs are persisted or otherwise reconciled so repeated requests can detect prior success | May require schema support or careful reconciliation design |
| REVIEW-004-003 | P1 | Make `refunded_cents` updates concurrency-safe | S | — | `refunded_cents` is incremented atomically (or guarded by compare-and-swap/transaction logic); concurrent partial refunds cannot overwrite each other's totals; tests cover two partial refunds against one order | Conditional updates may require retry handling on conflict |
| REVIEW-004-004 | P2 | Log rejected and upstream-failed refund attempts | S | — | All non-success branches emit structured `orders.refund.*` event logs with `order_id`, requested amount, and failure reason; operators can distinguish validation errors from Stripe upstream failures | None |

---

## H. Definition of Done — This Review

- [x] All sections A–G completed
- [x] P0 findings (REVIEW-004-001, REVIEW-004-002) have tasks created in `docs/TASKS.md`
- [x] All P1/P2 improvement tasks added to `docs/TASKS.md`
- [x] `docs/reviews/README.md` updated with Day 004 entry
- [x] Review record written to `docs/reviews/`
- [x] 500 LOC violation assessed; existing split-plan task (`REVIEW-001-015`) referenced

---

## Amendment — 2026-03-03

The REVIEW-004 backlog items were implemented in the codebase on 2026-03-03:

- `REVIEW-004-001`: `POST /api/orders/:id/refund` is now registered in `API_ROUTE_REGISTRY`, and undocumented API worker routes no longer bypass HMAC by default.
- `REVIEW-004-002`: Stripe refund calls now send a deterministic `Idempotency-Key`, and post-Stripe reconciliation/logging failures no longer return a retry-inviting 500.
- `REVIEW-004-003`: refund reconciliation now uses the `order_refunds` ledger (migration `0013_order_refunds_ledger.sql`) so the first ledger insert updates `orders.refunded_cents` exactly once via trigger.
- `REVIEW-004-004`: validation failures and Stripe upstream failures now emit structured `orders.refund.*` logs.
