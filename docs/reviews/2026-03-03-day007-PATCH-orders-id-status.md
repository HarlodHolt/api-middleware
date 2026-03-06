# Deep-Dive Review — Day 007

**Date:** 2026-03-03
**Target type:** Route
**Target:** `PATCH /api/orders/:id/status` — admin order status update with inventory restoration
**Primary file:** `olive_and_ivory_api/src/routes/coreRoutes.ts` (4835 LOC)
**Supporting files reviewed:** `src/index.ts` (auth/middleware registration)
**Reviewer:** —
**Status:** Complete

---

## Target Summary

`PATCH /api/orders/:id/status` is the designated endpoint for transitioning an order through its lifecycle states. It validates the incoming status against an allowlist, enforces limited state machine guards (blocking mutation of delivered and cancelled orders), optionally restores inventory stock when an order is cancelled, and emits both an event log and an audit log entry. A parallel `PUT /orders/:id` endpoint also accepts a `status` field but does not enforce the same transition guards — it can regress a delivered or cancelled order's status.

---

## A. Usage Mapping

### A1. Entry Points

| Caller | Repo | Runtime | Method | Trust Level |
|--------|------|---------|--------|-------------|
| Admin dashboard — order management UI | admin_olive_and_ivory_gifts | Browser → API Worker | PATCH | HMAC-authenticated internal caller |
| Automated fulfilment or ops scripts | Internal | Direct HTTP | PATCH | HMAC-authenticated |

### A2. Import / Reference Map

| Symbol | File | Lines | Purpose |
|--------|------|-------|---------|
| `tableExists` | coreRoutes.ts | 453–462 | Schema gate; cached per isolate in `_tableExistsCache` |
| `getTableColumns` | coreRoutes.ts | 464–475 | Column set for `orders`; cached per isolate in `_tableColumnsCache` |
| `restoreOrderInventoryStock` | coreRoutes.ts | 782–815 | Reverse stock deductions for all items in a cancelled order |
| `logAction` | coreRoutes.ts | 481–514 | Write structured record to `event_logs` |
| `writeAuditLog` | coreRoutes.ts | 550–595 | Write before/after snapshot to `audit_logs` with PII redaction |
| `getMeta` | coreRoutes.ts | 409–425 | Extract correlation ID, request ID, IP, actor identity |
| `ok` / `fail` | coreRoutes.ts | 427–445 | Standard JSON response builders |
| `ORDER_STATUSES` | coreRoutes.ts | 114 | Allowlist: `["pending","paid","packed","out_for_delivery","delivered","cancelled"]` |
| `withAuthHmac` | api-middleware | index.ts:140 | HMAC verification applied globally before route handlers |
| `withRateLimit` | api-middleware | index.ts:130 | 60 req/min per IP, applied globally |

### A3. Call Graph (abbreviated)

```
HMAC-authenticated PATCH /orders/:id/status
  └── patchOrderStatusHandler (coreRoutes.ts:4083)
        ├── parseBody<{ status?, reason? }>(c)         [safe: catches malformed JSON]
        ├── ORDER_STATUSES.includes(targetStatus)      [allowlist validation]
        ├── tableExists(db, "orders")                  [schema gate; cached]
        ├── getTableColumns(db, "orders")              [column set; cached]
        ├── SELECT * FROM orders WHERE id = ?          [before-image — returns full PII row]
        ├── [state machine guards: delivered / cancelled terminal checks]
        ├── restoreOrderInventoryStock(db, id)         [N serial INSERT ON CONFLICT — NOT atomic]
        ├── UPDATE orders SET status=?, ... WHERE id = ?
        ├── SELECT * FROM orders WHERE id = ?          [after-image — full PII row]
        ├── logAction(c, { prev_status, new_status, stock_restored, reason })
        │     └── [NO catch — event_log failure propagates as 500]
        └── writeAuditLog(c, { before, after })        [PII redacted via redactOrderPii; catch: console.warn]
```

### A4. Data Flow Summary

The handler reads `{ status, reason }` from the JSON body. After validating `status` against the allowlist, it fetches the current order row. If the order is already `delivered` or `cancelled`, a 409 is returned. If the transition is to `cancelled` and stock has not yet been restored, `restoreOrderInventoryStock` computes per-item restore quantities from `order_items` → `gifts` → `gift_inventory_items` and upserts `inventory_stock` one row at a time. The `orders.status` UPDATE then executes. A post-image is fetched. Both an event record (status change metadata only) and an audit record (full before/after with PII redaction) are written. The response returns the updated order row.

### A5. Trust Boundaries Crossed

| From | To | Mechanism | Trust Established By |
|------|----|-----------|----------------------|
| Admin caller | API Worker | HTTPS + HMAC | `withAuthHmac` with `HMAC_SHARED_SECRET` |
| API Worker | D1 `orders` | D1 binding | Cloudflare binding — internal only |
| API Worker | D1 `order_items`, `gifts`, `gift_inventory_items`, `inventory_stock` | D1 binding | Cloudflare binding — internal only |
| API Worker | D1 `event_logs` | D1 binding | Cloudflare binding — internal only |
| API Worker | D1 `audit_logs` | D1 binding | Cloudflare binding — internal only |

---

## B. Database and Data Flow

### B1. D1 Tables Accessed

| Table | Operation | Fields Read | Fields Written | Notes |
|-------|-----------|-------------|----------------|-------|
| `orders` | SELECT (before) | `*` — all columns including PII | — | Full customer PII returned in before-image |
| `orders` | UPDATE | — | `status`, `updated_at`, `order_stock_restored`, `cancel_reason` (conditional) | Column existence checked via `_tableColumnsCache` |
| `orders` | SELECT (after) | `*` — all columns | — | Full PII row returned to caller and stored in audit log |
| `order_items` | SELECT (in restoreOrderInventoryStock) | `collection_id`, `quantity` | — | Used to compute items to restore |
| `gifts`, `gift_inventory_items` | SELECT JOIN (in restoreOrderInventoryStock) | `inventory_id`, `quantity` | — | Maps collection to inventory items |
| `inventory_stock` | INSERT ON CONFLICT (per item) | — | `stock_on_hand`, `updated_at` | One prepared statement per item; executed serially, not batched |
| `event_logs` | INSERT | — | Structured event fields | Via `logAction` |
| `audit_logs` | INSERT | — | All columns | Via `writeAuditLog`; PII redacted before write |

### B2. Transactions and Atomicity

**FINDING — P1:** Stock restoration and the `orders` UPDATE are not atomic. The sequence is:

1. `restoreOrderInventoryStock(db, id)` — N serial upserts to `inventory_stock`
2. `UPDATE orders SET status = 'cancelled' ...`

If the UPDATE fails after stock restoration succeeds (e.g. transient D1 error), stock is permanently restored but the order remains in its previous non-cancelled state. The `order_stock_restored` flag is only set on the `orders` row inside the UPDATE, so a subsequent cancel attempt on the same order will attempt to restore stock again.

Within `restoreOrderInventoryStock`, each `inventory_stock` upsert is a separate `db.prepare(...).run()` call in a serial loop. A mid-loop failure leaves stock partially restored with no record of which items were updated.

### B3. External APIs Touched

None. This route does not call Stripe or any external service.

### B4. R2 / KV / Cache Usage

None. Module-level `_tableExistsCache` and `_tableColumnsCache` are used for schema introspection caching.

### B5. Legacy Schema Observations

The handler conditionally checks for `orderColumns.has("updated_at")` and `orderColumns.has("cancel_reason")` before including those fields in the UPDATE. This indicates the `orders` schema has evolved and these columns may be absent in older deployments. It is a compatibility shim that adds query logic complexity.

### B6. Index and Performance Observations

- `SELECT * FROM orders WHERE id = ?` — `id` is a UUID primary key; should be indexed by default.
- `restoreOrderInventoryStock` issues N serial INSERT ON CONFLICT statements. For orders with many line items this is multiple sequential D1 round trips. `db.batch()` is available and would execute these atomically in a single round trip.
- Two full `SELECT *` reads per request (before + after) when a subset of columns is sufficient.
- Schema introspection cached — not a concern.

---

## C. Security Review

### C1. Authentication

Protected by `withAuthHmac` applied globally in `src/index.ts:140`. The path `/orders/:id/status` is not in `PUBLIC_PATHS` (index.ts:99–125) and matches no public-collection exception. HMAC authentication is required.

Rate limiting: `withRateLimit` enforces 60 req/min per IP globally; this path is not in the rate limit skip set.

### C2. Authorisation

**FINDING — P1 (latent IDOR):** The order `id` is taken from the URL path parameter with no scope or ownership check. Any HMAC-authenticated caller that knows (or can enumerate) an order ID can update its status. For the current single-tenant deployment this is acceptable in practice. If the API ever extends to multi-tenant use, this route will permit cross-account status writes without any code change.

There is no role distinction within the handler — HMAC auth is binary. All HMAC-authenticated callers have equal write access to all orders.

### C3. Input Validation

| Field | Validated | Notes |
|-------|-----------|-------|
| `:id` (URL param) | Presence only (Hono routing) | No format or length check; passed to a parameterised query — no injection risk, but an unexpected format could generate confusing 404s |
| `status` | Allowlist check against `ORDER_STATUSES` | ✓ |
| `reason` | Presence check only, when `cancel_reason` column exists | **No length limit** — an unbounded string is accepted and written to D1 |
| Body JSON | Caught via `parseBody` wrapping `.json()` in try/catch | ✓ — returns 400 on parse failure |

### C4. Injection Risks

All D1 queries use parameterised statements. The dynamic `UPDATE orders SET ${updates.join(", ")}` interpolates hardcoded column name strings only — not user input. No injection risk.

`restoreOrderInventoryStock` uses table names from `tableExists`-gated hardcoded strings — not user-controlled. Safe.

### C5. SSRF / Open Redirect

None. No outbound fetches in this handler.

### C6. Webhook Abuse

Not applicable.

### C7. Rate Limiting

Global 60 req/min per IP applies. No per-order-id limit. A caller could spam status transitions on one order, triggering repeated stock restore loops. Given HMAC authentication is required, this demands a compromised key.

### C8. PII Handling

`SELECT *` on the `orders` table returns all customer fields (name, email, phone, delivery address, gift message). These fields are:

- Returned to the caller in the response body (`{ order: after }`) — expected for an admin endpoint
- Written to `audit_logs` via `writeAuditLog` — `redactOrderPii` is applied to both before and after snapshots ✓
- **Not present** in the event log payload from `logAction` — that payload contains only `{ prev_status, new_status, stock_restored, reason }` ✓

### C9. Secrets Handling

No secrets accessed in this handler. HMAC secret is consumed by middleware upstream.

### C10. Edge / Runtime Exposure

All operations use D1 bindings and `crypto.randomUUID()`. No Node.js APIs. Edge-safe.

### C11. Multi-Tenant Leakage

Single-tenant. No cross-account risk in current deployment.

### C12. Abuse Vectors

| Vector | Current State | Risk |
|--------|---------------|------|
| Status spam on one order (repeated restore loops) | No per-order throttle; global 60/min per IP | Low — requires compromised HMAC key |
| Unbounded `reason` string written to DB | No length cap | Low — authenticated callers only |
| Partial stock restore on mid-sequence DB failure | Non-atomic; no compensating rollback | Medium — data integrity risk on transient D1 error |
| Status regression via `PUT /orders/:id` | `PUT` handler accepts `status` with weaker guards — no delivered/cancelled terminal block | High — effectively bypasses this handler's state machine entirely |

---

## D. Observability and Operations

### D1. Logging Completeness

- Success path: `logAction` writes event with `{ prev_status, new_status, stock_restored, reason }`; `writeAuditLog` records full before/after with PII redaction. ✓
- 404 (order not found): No event log written. Acceptable.
- 409 (invalid transition): **No event log written.** Blocked status transitions are not auditable — a P2 gap.
- 400 / 503 paths: No event log. Acceptable.
- Correlation IDs propagated from context via `getMeta`. ✓

### D2. Error Handling

- `parseBody` catches malformed JSON and returns 400. ✓
- Outer `try/catch` returns 500 with `error.message` included in the response — this leaks internal DB error details (constraint names, column names) to the caller. For a fully authenticated admin API the risk is tolerable, but it should be scoped.
- **FINDING — P1:** `logAction` is called without a surrounding try/catch. If `event_logs` is unavailable (e.g. D1 schema missing or transient failure), an unhandled rejection propagates through the outer catch and returns 500 — even after the order status has already been successfully updated. The `writeAuditLog` call immediately after has a catch block and is safe.
- `writeAuditLog` catch logs `console.warn` and does not re-throw. Non-fatal. ✓

### D3. Retry Logic

Not applicable. Status updates are not automatically retried.

### D4. Performance Hotspots

- `restoreOrderInventoryStock`: N serial `db.prepare(...).run()` calls in a loop. Should use `db.batch()`.
- Two `SELECT *` reads per request when only status-relevant columns are needed.
- Schema introspection calls (`tableExists`, `getTableColumns`) are cached at isolate level — negligible after first call.

### D5. Failure Scenarios

| Failure | Current Behaviour |
|---------|------------------|
| D1 unreachable on before-SELECT | Exception caught by outer try/catch; 500 returned; no stock changes made |
| D1 unreachable mid-stock-restore | Some items restored, some not; order status not updated; 500 returned; no compensation |
| D1 unreachable on UPDATE (after stock restore completes) | Stock permanently restored; order not cancelled; inconsistent state; 500 returned |
| `event_logs` INSERT fails | `logAction` has no catch; exception propagates to outer catch; 500 returned even if order was already updated |
| `audit_logs` INSERT fails | Caught by `writeAuditLog` catch block; non-fatal `console.warn`; order update succeeds ✓ |

---

## E. Documentation Gaps

### E1. Architecture Doc Updates Required

`docs/ARCHITECTURE.md` should document:
- The order status state machine and valid transitions.
- The dual-path status update (`PATCH /orders/:id/status` and `PUT /orders/:id`) and the divergent enforcement between the two handlers.

### E2. Security Doc Updates Required

`docs/SECURITY.md` should note:
- Latent IDOR on all order routes — single-tenant safe today; no cross-tenant scoping exists.
- `PUT /orders/:id` bypasses the state machine guards enforced by `PATCH /orders/:id/status`.

### E3. Database Doc Updates Required

`docs/DATABASE_DESIGN.md` should note:
- `order_stock_restored` flag semantics and the non-atomic stock-restore risk.
- `cancel_reason` and `updated_at` column presence is schema-conditional (compatibility shim).

---

## F. 500 LOC Assessment

**Primary file LOC:** 4835
**Violation:** Yes — 9.7× the 500 LOC limit

### Responsibilities Currently in This File

| Domain | Approx. Lines | Description |
|--------|--------------|-------------|
| Types, constants, module-level utilities | 1–115 | Shared types and allowlists |
| Route helpers (getMeta, ok, fail, logAction, writeAuditLog, tableExists, etc.) | 116–595 | Cross-cutting infrastructure |
| Collection/gift value builders | 596–682 | Mutation input normalisation |
| Gift item relation helpers | 683–780 | Inventory resolution for gifts |
| Inventory stock helpers | 782–815 | Stock restoration on cancellation |
| Gift media helpers | 817–1170 | Media management for gift records |
| Collection gift link helpers + legacy compat | 997–1453 | Collection→gift relationships |
| Collection route handlers | 1454–2199 | Collections CRUD + in-collection gift management |
| AI suggest route handlers | 2200–2751 | AI content generation for collections, gifts, inventory |
| Gift route handlers | 2834–3420 | Gifts CRUD + media + AI runs |
| CMS route handlers | 3439–3582 | Featured collections, hero slides |
| Order route handlers | 3689–4485 | Order CRUD + status + refund |
| Delivery + health route handlers | 4520–4619 | Delivery options/quote, deep health check |
| Newsletter route handler | 4621–4835 | Newsletter subscribe |

### Split Plan

| Proposed File | Responsibility | Extracted From | LOC Estimate |
|--------------|---------------|----------------|--------------|
| `src/lib/routeUtils.ts` | getMeta, ok, fail, parseBody, tableExists, getTableColumns, logAction, writeAuditLog, redactOrderPii, toStatusCode, module-level schema caches | coreRoutes.ts:116–595 | ~200 |
| `src/lib/orderHelpers.ts` | validateCreateOrderInput, createStripeCheckoutSession, isAllowedRedirectUrl, centsFromCollection, restoreOrderInventoryStock, ORDER_FIELD_MAX_LENGTHS | coreRoutes.ts:182–374, 782–815 | ~250 |
| `src/lib/giftHelpers.ts` | buildGiftValueMap, clampFocal, safeJsonField, validateVariantsJson, maybeLoadGiftItems, hasGiftMediaTable, maybeLoadGiftMedia, backfillGiftMediaFromGiftRecord, buildGiftMediaValueMap, normalizeGiftMediaPrimaryRow, syncGiftHeroFromPrimaryMedia, pickGiftPreviewKey | coreRoutes.ts:620–1170 | ~400 |
| `src/lib/collectionHelpers.ts` | buildCollectionValueMap, upsertCollectionGiftLinks, clearCollectionGiftLinks, findMissingGiftIds, maybeLoadGiftsFromVariants, maybeLoadCollectionGifts, upsertDefaultGiftFromCollection, syncDefaultGiftItemsFromLegacy, replaceGiftsForCollection, countOrderReferences | coreRoutes.ts:597–619, 997–1453 | ~450 |
| `src/routes/collections.ts` | Collection CRUD handlers (list, get, create, update, delete, schema) | coreRoutes.ts:1454–2034 | ~400 |
| `src/routes/collectionGifts.ts` | Collection→gift relationship handlers (list, add, reorder, remove) | coreRoutes.ts:1770–1915 | ~150 |
| `src/routes/ai.ts` | AI suggest handlers for collections, gifts, inventory | coreRoutes.ts:2200–2751 | ~350 |
| `src/routes/gifts.ts` | Gift CRUD handlers (list, get, create, update, delete, stock report) | coreRoutes.ts:2834–3052 | ~220 |
| `src/routes/giftMedia.ts` | Gift media handlers (list, create, reorder, update, delete) | coreRoutes.ts:3068–3311 | ~250 |
| `src/routes/giftAi.ts` | Gift AI runs handlers + AI suggest routes | coreRoutes.ts:3398–3423 | ~30 |
| `src/routes/cms.ts` | Featured collections + hero slides handlers | coreRoutes.ts:3439–3582 | ~150 |
| `src/routes/orders.ts` | Order list, create, get, update handlers | coreRoutes.ts:3689–4080 | ~400 |
| `src/routes/orderActions.ts` | Order status patch, refund, delete handlers | coreRoutes.ts:4082–4485 | ~400 |
| `src/routes/delivery.ts` | Delivery options/quote + deep health | coreRoutes.ts:4520–4619 | ~100 |
| `src/routes/newsletter.ts` | Newsletter subscribe handler | coreRoutes.ts:4621–4835 | ~215 |
| `src/routes/coreRoutes.ts` (residual) | `registerCoreRoutes` entry point — imports and delegates to sub-modules | — | ~50 |

**Risk notes:**

- Shared helpers (`routeUtils.ts`) must be extracted before any route module — circular import risk if route modules are split first.
- Several handler functions call sibling handlers within the same `registerCoreRoutes` closure (e.g. `reorderCollectionGiftsHandler` calls `listCollectionGiftsHandler`). These cross-calls must be resolved (either export + import, or inline the list response logic) before those handlers can live in separate files.
- `_tableExistsCache` and `_tableColumnsCache` are module-level singletons. They must move to `routeUtils.ts` and be imported everywhere.
- `extractOpenAiErrorInfo` and AI-specific types should move to a shared AI lib (e.g. `src/lib/aiUtils.ts`), not into route utils.
- The `/api/` dual-registration pattern (every route registered twice, with and without `/api/` prefix) must be preserved in every extracted module's registration function.

**Rollback notes:**

- Extract one domain at a time (suggested order: routeUtils → orderHelpers → giftHelpers → collectionHelpers → cms → delivery → newsletter → orders → gifts → collections → ai).
- Smoke-test the API against staging D1 after each extraction step before proceeding.
- Each extraction step should be a single, independently reviewable commit.

---

## G. Improvement Backlog

| ID | Priority | Title | Effort | Owner | Acceptance Criteria | Risk |
|----|----------|-------|--------|-------|---------------------|------|
| REVIEW-007-001 | P1 | Split `coreRoutes.ts` (4835 LOC) into domain-scoped modules | L | — | Each extracted module ≤500 LOC; all routes verified against staging after each step; no module-level cache singleton broken; dual /api/ prefix registration preserved | High — large refactor; incremental per-domain commits required |
| REVIEW-007-002 | P1 | Make stock restore + status UPDATE atomic | M | — | `restoreOrderInventoryStock` and `UPDATE orders SET status` execute atomically; if UPDATE fails, stock changes are either rolled back (via D1 batch) or compensated before any stock upsert is applied; `order_stock_restored` only set on confirmed success | Medium — D1 batch does not guarantee rollback; may need a pre-restore check-then-batch pattern |
| REVIEW-007-003 | P1 | Fix `PUT /orders/:id` state machine bypass | S | — | `updateOrderHandler` enforces identical delivered/cancelled terminal transition guards as `patchOrderStatusHandler`; tests cover direct PUT regressions | Low — isolated change to updateOrderHandler |
| REVIEW-007-004 | P1 | Wrap `logAction` call in patchOrderStatusHandler with try/catch | S | — | `logAction` failure does not surface as 500 on an otherwise-successful status update; error is logged to `console.warn` and swallowed | Low — isolated change |
| REVIEW-007-005 | P2 | Add length limit on `reason` field | S | — | `reason` capped at 500 characters; values exceeding limit return 400 before any DB write | None |
| REVIEW-007-006 | P2 | Batch `inventory_stock` upserts in `restoreOrderInventoryStock` | S | — | Serial per-item `run()` calls replaced with `db.batch(statements)`; semantics preserved | Low — change isolated to restoreOrderInventoryStock |
| REVIEW-007-007 | P2 | Log 409 state transition rejections to `event_logs` | S | — | `logAction` called on invalid transition response with `level: "warn"` and `action: "orders.status_rejected"`; payload includes `order_id`, `from_status`, `to_status` | None |
| REVIEW-007-008 | P2 | Replace `SELECT *` before/after reads with explicit column lists | S | — | SELECT specifies required columns only; confirm response contract with admin UI before removing any field | Low — confirm UI dependencies first |

---

## H. Definition of Done — This Review

- [x] All sections A–G completed
- [x] P1 findings REVIEW-007-001 through 007-004 have tasks created in `docs/TASKS.md`
- [x] P2 tasks REVIEW-007-005 through 007-008 added to `docs/TASKS.md`
- [x] `docs/ARCHITECTURE.md` — order status state machine and dual-path update gap noted
- [x] `docs/SECURITY.md` — latent IDOR on order routes and PUT bypass noted
- [x] `docs/DATABASE_DESIGN.md` — `order_stock_restored` semantics and non-atomic restore risk noted
- [x] Review record committed to `docs/reviews/`
