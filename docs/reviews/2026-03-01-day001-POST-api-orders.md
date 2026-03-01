# Deep-Dive Review — Day 001

**Date:** 2026-03-01
**Target type:** Route
**Target:** `POST /api/orders` — Order creation and Stripe checkout session initiation
**Primary file:** `olive_and_ivory_api/src/routes/coreRoutes.ts` (4,372 LOC — **VIOLATION**)
**Supporting files reviewed:**
- `olive_and_ivory_api/src/index.ts` (2,549 LOC — **VIOLATION**)
- `olive_and_ivory_gifts/src/app/api/checkout/create/route.ts` (142 LOC)
**Reviewer:** —
**Status:** Complete

---

## Target Summary

`POST /api/orders` is the order creation endpoint in the API worker. It accepts a validated checkout payload from the storefront (customer details, delivery address, cart items), resolves collection prices and delivery fees from D1, inserts an order record and associated `order_items` rows, and — if a Stripe secret key is configured — calls the Stripe Checkout Sessions API to obtain a hosted payment URL.

This is the single most financially sensitive route in the platform. A successful order here initiates a payment transaction. Errors in this path directly affect revenue, customer experience, and data integrity.

The route is registered twice: `/orders` and `/api/orders`. Both registrations point to the same handler (`createOrderHandler`). The canonical path used in production is `/api/orders`.

---

## A. Usage Mapping

### A1. Entry Points

| Caller | Repo | Runtime | Method | Trust Level |
|--------|------|---------|--------|-------------|
| `POST /api/checkout/create` (storefront) | `olive_and_ivory_gifts` | Cloudflare Pages / Node.js | HMAC-signed proxy via `signedApiFetch` | Public internet → storefront (rate-limited 30/min per IP) → API worker (HMAC required) |
| Direct API call (admin or integration) | Any HMAC-capable caller | Any | POST | HMAC-authenticated |

### A2. Import / Reference Map

| Symbol | File | Lines | Purpose |
|--------|------|-------|---------|
| `createOrderHandler` | `coreRoutes.ts` | 3370–3588 | Main handler body |
| `validateCreateOrderInput()` | `coreRoutes.ts` | 191–246 | Validates and coerces the raw request body |
| `createStripeCheckoutSession()` | `coreRoutes.ts` | 248–285 | Constructs and fires the Stripe Checkout Sessions API call |
| `centsFromCollection()` | `coreRoutes.ts` | 180–189 | Reads price from a collection DB row |
| `computeEarliestDeliveryDate()` | `coreRoutes.ts` | 1096–1134 | Returns earliest valid delivery date (business day logic) |
| `normalizeAuState()` | `coreRoutes.ts` | 1135–1140 | Normalises AU state abbreviations |
| `getDeliveryQuote()` | `coreRoutes.ts` | 1141–~1180 | Reads delivery zone from D1 and returns fee |
| `tableExists()` | `coreRoutes.ts` | (utility) | Guards against missing schema |
| `getTableColumns()` | `coreRoutes.ts` | (utility) | Runtime schema introspection via `sqlite_master` |
| `logAction()` | `coreRoutes.ts` | (utility) | Structured event logging |
| `writeAuditLog()` | `coreRoutes.ts` | (utility) | Audit trail writes |
| `ok()` / `fail()` | `coreRoutes.ts` | 311–330 | Response helpers |
| `signedApiFetch()` | `olive_and_ivory_gifts/src/lib/externalApi.ts` | — | HMAC-signs and forwards the request from storefront to worker |
| `checkCheckoutRateLimit()` | `checkout/create/route.ts` | 15–29 | In-memory rate limiter on the storefront side |
| `withRateLimit()` | `api-middleware` | — | Durable D1-backed rate limiter on the worker side (60 req/60s global) |
| `withAuthHmac()` | `api-middleware` | — | HMAC signature verification middleware |

### A3. Call Graph (abbreviated)

```
Browser / Storefront client
  └── POST /api/checkout/create  (storefront Pages Function)
        ├── checkCheckoutRateLimit()   [in-memory, per-IP, 30/min]
        ├── request.json()             [raw body parse]
        └── signedApiFetch(POST /api/orders)
              │
              ▼
        Cloudflare Worker — withHonoPipeline:
              ├── withRequestContext()
              ├── withRateLimit()         [D1-backed, 60/60s global]
              ├── withAuthHmac()          [validates HMAC-SHA256 signature + nonce]
              └── withJsonBody(16 KiB)
                    │
                    ▼
              createOrderHandler()
                ├── validateCreateOrderInput()
                ├── tableExists(db, "orders")
                ├── tableExists(db, "collections")
                ├── isValidIsoDateOnly()
                ├── computeEarliestDeliveryDate()
                ├── delivery day-of-week check (UTC)
                ├── D1 SELECT — collections WHERE id IN (...)
                ├── getDeliveryQuote()
                │     └── D1 SELECT — delivery_zones
                ├── D1 INSERT — orders
                ├── D1 BATCH INSERT — order_items  (if table exists)
                ├── createStripeCheckoutSession()
                │     └── fetch("https://api.stripe.com/v1/checkout/sessions")
                ├── D1 UPDATE — orders SET payment_provider, payment_status, payment_reference
                ├── D1 SELECT — orders WHERE id = ?   (re-fetch for response)
                ├── logAction()
                └── writeAuditLog()
```

### A4. Data Flow Summary

The storefront client sends a checkout payload (customer info, delivery address, delivery date, cart items) to the storefront's `/api/checkout/create`. That route rate-limits the request per IP, injects `site_base_url`, and forwards the whole payload via HMAC-signed fetch to the API worker's `POST /api/orders`.

The worker validates the payload, resolves collection prices and delivery fees from D1, computes totals, inserts the order and line items, then calls Stripe to create a hosted checkout session. If Stripe succeeds, the order record is updated with the payment reference and provider. The worker returns the Stripe checkout URL. The storefront relays that URL to the browser, which redirects the user to Stripe-hosted payment.

### A5. Trust Boundaries Crossed

| Boundary | Direction | Controls |
|----------|-----------|----------|
| Public internet → Storefront Pages Function | Inbound | HTTPS only; rate limit 30/min per IP (in-memory) |
| Storefront Pages Function → API Worker | Outbound | HMAC-SHA256 signature + nonce via `signedApiFetch`; worker verifies with `withAuthHmac` |
| API Worker → Stripe API | Outbound | Bearer token (`STRIPE_SECRET_KEY`); Idempotency-Key per order ID |
| API Worker → D1 | Internal | Cloudflare binding; no network exposure |

---

## B. Database and Data Flow

### B1. D1 Tables Accessed

| Table | Operation | Fields Read | Fields Written | Notes |
|-------|-----------|-------------|----------------|-------|
| `orders` | INSERT, UPDATE, SELECT | `id`, all columns | All order fields, then `payment_provider`, `payment_status`, `payment_reference` | Written in two separate statements (not atomic) |
| `order_items` | BATCH INSERT | — | `id`, `order_id`, `collection_id`, `collection_slug`, `collection_name`, `quantity`, `unit_price_cents`, `unit_price`, `line_total_cents`, `line_total` | Only if table exists; `unit_price` and `line_total` are duplicate legacy fields |
| `collections` | SELECT | `id`, `price_cents`, `price`, `name`, `slug` | — | No visibility/active filter applied |
| `delivery_zones` | SELECT (via `getDeliveryQuote`) | `country`, `state`, `zone_key`, `fee_cents` | — | |
| `api_rate_limits` | SELECT, INSERT, UPDATE, DELETE | `ip_address`, `window_start`, `request_count` | — | Used by `withRateLimit` at middleware level |
| `sqlite_master` | SELECT | `name` (table existence), column names | — | Called multiple times per request for `tableExists` + `getTableColumns` |

### B2. Transactions and Atomicity

**Critical: the order creation flow is NOT atomic.**

The sequence of writes is:

1. `INSERT INTO orders` — order record committed immediately.
2. `db.batch([...INSERT INTO order_items...])` — separate D1 batch. If this fails, the order exists with no line items.
3. `fetch(Stripe API)` — external call. If Stripe fails or times out, the order exists in `pending` state but no payment session exists.
4. `UPDATE orders SET payment_provider, payment_status, payment_reference` — separate statement. If this fails, the order has the wrong payment metadata.
5. `SELECT * FROM orders` — re-fetch for response body.

A failure between steps 1 and 2 produces an order with no items. A failure between steps 2 and 3 produces a `manual/pending` order that is never paid. A failure between steps 3 and 4 produces a `payment_provider = 'manual'` order even though a Stripe session was created.

There is no compensating rollback, no idempotent retry path, and no mechanism to detect and reconcile these orphan states other than manual inspection.

### B3. External APIs Touched

| Service | Endpoint | Auth Method | Idempotency | Failure Handling |
|---------|----------|-------------|-------------|-----------------|
| Stripe | `POST /v1/checkout/sessions` | Bearer token (`STRIPE_SECRET_KEY`) | `Idempotency-Key: checkout_session:{orderId}` | Stripe failure is caught; order remains in DB as `manual/pending`; no rollback |

**Idempotency note:** The Idempotency-Key is `checkout_session:{orderId}`, which ties the Stripe session to the order UUID. If the handler retries (due to Worker timeout or consumer retry), Stripe will return the same session. This is correct. However, if the order INSERT succeeded but the Stripe call timed out, a retry of the entire request will fail at the D1 INSERT (duplicate primary key) before reaching Stripe — resulting in a 500 with no payment URL returned.

### B4. R2 / KV / Cache Usage

None in this handler. Collection images are not touched. R2 is not accessed.

### B5. Legacy Schema Observations

- **Duplicate address fields:** `orders` table has both `delivery_address_line1` / `delivery_suburb` / `delivery_state` / `delivery_postcode` / `delivery_country` AND `address_line1` / `address_suburb` / `address_state` / `address_postcode` / `address_country`. Both sets are written with identical values. This is schema drift from a legacy rename. The `address_*` columns appear to be the old form. Both columns are active.
- **Duplicate pricing fields in `order_items`:** Both `unit_price_cents` and `unit_price` are written (same integer value). Both `line_total_cents` and `line_total` are written. The `_cents` variants are canonical; the bare names are legacy.
- **`total_amount` column:** Written as `total_cents` but also stored in `total_amount` (same integer value). Legacy duplicate.

### B6. Index and Performance Observations

- `tableExists()` queries `sqlite_master` using `SELECT name FROM sqlite_master WHERE type='table' AND name=?`. This is called for `orders`, `collections`, `order_items`, and within `getDeliveryQuote`. That is **4+ separate `sqlite_master` reads per request**. `sqlite_master` reads are lightweight but add latency when the Worker is under load.
- `getTableColumns()` reads all column definitions from `sqlite_master` for the `orders` table (and `order_items`). This is also a per-request runtime introspection call. Combined with `tableExists`, that is up to **6 `sqlite_master` queries per order creation request**.
- Both could be replaced with a module-level schema cache (populated once at Worker startup) with no correctness risk, since schema changes require a migration.
- No missing indexes identified for the `orders` table (primary key lookup only in this handler). The `collections WHERE id IN (...)` query relies on primary key — correct.

---

## C. Security Review

### C1. Authentication

`POST /api/orders` is **not** in the `PUBLIC_PATHS` set in `index.ts`. It therefore goes through `withAuthHmac()` from `api-middleware`.

`withAuthHmac` is configured with:
```typescript
skip: (request) => {
  const path = new URL(request.url).pathname;
  if (PUBLIC_PATHS.has(path) || path.startsWith("/public/collections/") ...) return true;
  return !findRouteDoc(path);
}
```

**The `!findRouteDoc(path)` skip condition is a potential auth bypass vector.** If `/api/orders` is not registered in `API_ROUTE_REGISTRY`, `findRouteDoc` returns `undefined`/falsy, the skip function returns `true`, and HMAC auth is **skipped**. Verification of whether `/api/orders` is in the registry is required. This is a P0 verification task.

The storefront calls this endpoint via `signedApiFetch`, which attaches a valid HMAC signature. Direct callers (e.g. integration tests, admin scripts) must also supply a valid HMAC signature.

### C2. Authorisation

There is **no user-level authorisation** on this endpoint. Any caller with a valid HMAC signature can create an order for any customer email, any delivery address, and any collection IDs. This is expected for a public checkout flow (customers create their own orders), but it means:

- There is no concept of a "logged-in customer" gating order creation.
- An authenticated API caller can create orders on behalf of arbitrary customers, including with arbitrary email addresses.
- There is no per-customer rate limit at the worker level (only a global 60/60s IP rate limit and a storefront-side 30/min IP rate limit).

### C3. Input Validation

**`validateCreateOrderInput()` analysis — field by field:**

| Field | Validated | Issues |
|-------|-----------|--------|
| `customer_name` | Non-empty string | No max length. A 100 KB name would be written to D1. |
| `customer_email` | Non-empty string, lowercased | **No format validation.** `"not-an-email"` passes. Stripe will fail silently at session creation if the email is malformed; the order is still created. |
| `customer_phone` | Non-empty string | No format, no max length. |
| `delivery_address_line1` | Non-empty string | No max length. |
| `delivery_address_line2` | Optional string | No max length. |
| `delivery_suburb` | Non-empty string | No max length. |
| `delivery_state` | Non-empty string | Not validated against known AU states. `normalizeAuState()` normalises known abbreviations but passes unknown values through unchanged. |
| `delivery_postcode` | Non-empty string | No format validation (should be 4-digit AU format). |
| `delivery_country` | Optional string, uppercased | Not validated against ISO 3166 list. Any string accepted. |
| `delivery_date` | ISO date format `YYYY-MM-DD` | Format validated. Earliest date enforced. Sunday blocked (UTC — see C5). |
| `gift_message` | Optional string | **No max length.** |
| `customer_notes` | Optional string | **No max length.** |
| `delivery_notes` | Optional string | **No max length.** |
| `cart_items` | Array, non-empty | Max 1 item not enforced — large carts accepted. |
| `cart_items[].collection_id` | Non-empty string | Not validated as UUID format. Any string is passed into `WHERE id IN (...)` — parameterised so SQL injection is blocked. |
| `cart_items[].quantity` | Integer ≥ 1 | Max quantity not enforced. |
| `success_url` | Optional string from body | **No domain validation.** See C5. |
| `cancel_url` | Optional string from body | **No domain validation.** See C5. |
| `site_base_url` | Optional string from body (read directly) | **No domain validation.** See C5. |

### C4. Injection Risks

- **SQL injection:** All D1 queries use parameterised binds (`?` placeholders). No string interpolation into SQL. No SQL injection risk.
- **Template injection:** None identified.
- **Prompt injection:** Not applicable in this handler.
- **Header injection:** `customer_email` is passed to Stripe as a form field value. Stripe's own API validates email. Low risk.

### C5. SSRF / Open Redirect

**P0 — SSRF / Open Redirect via `success_url`, `cancel_url`, and `site_base_url`.**

The handler constructs Stripe redirect URLs as follows:

```typescript
// From request body — no domain validation:
const siteBase = body.site_base_url && typeof body.site_base_url === "string"
  ? String(body.site_base_url).replace(/\/$/, "")
  : "";
const successUrl = input.success_url || (siteBase ? `${siteBase}/order-confirmation` : "");
const cancelUrl = input.cancel_url || (siteBase ? `${siteBase}/checkout` : "");
```

These URLs are passed **directly to Stripe** as the `success_url` and `cancel_url` for the checkout session:

```typescript
form.set("success_url", `${args.successUrl}...`);
form.set("cancel_url", `${args.cancelUrl}...`);
```

An attacker with a valid HMAC signature (or in the event of the `findRouteDoc` auth bypass above) can submit:
```json
{ "success_url": "https://attacker.example.com/steal?token=", ... }
```

Stripe will redirect the customer to `attacker.example.com` after successful payment. This is a **post-payment open redirect** that can be used to steal the Stripe `session_id` appended to the URL, or to phish customers after payment confirmation.

The legitimate storefront caller (`checkout/create/route.ts`) derives `siteBaseUrl` from the request's own origin (`new URL(request.url).protocol + host`), which is safe. However, the worker accepts `success_url` / `cancel_url` / `site_base_url` from the raw body without restriction — any HMAC-capable caller can inject arbitrary URLs.

**Fix:** Validate that `successUrl` and `cancelUrl` start with the platform's known domain(s) before passing to Stripe. A domain allowlist should be stored in environment config or derived from a `SITE_BASE_URL` env var.

### C6. Webhook Abuse

Not applicable to this route. Order creation does not handle Stripe webhooks. Stripe webhook processing is a separate route (`POST /api/stripe/webhook`) scheduled for Day 002.

### C7. Rate Limiting

Two rate limits apply:

| Layer | Limit | Mechanism | Durability | Bypass Risk |
|-------|-------|-----------|------------|-------------|
| Storefront (`checkout/create`) | 30 req/60s per IP | In-memory `Map` in Pages Function instance | **Not durable** — reset on instance restart, not shared across Cloudflare edge nodes | Any client rotating IPs, or hitting different edge nodes, bypasses this entirely |
| API Worker (all routes) | 60 req/60s per IP | D1-backed `api_rate_limits` table via `withRateLimit` | Durable — survives instance restarts | D1 write latency could cause rate limit misses under burst load; D1 is not a true atomic counter |

The in-memory rate limiter on the storefront is **not a meaningful security control**. It is a client-experience guardrail only. It provides no protection against distributed or multi-edge abuse. The D1-backed limit at the worker is more reliable but not guaranteed to be atomic under concurrent burst.

There is no per-email or per-collection rate limit. An attacker can create large numbers of orders for the same collection with different customer details.

### C8. PII Handling

The following PII is processed and stored:

| Field | Stored In | Logged | Redacted in Logs |
|-------|-----------|--------|-----------------|
| `customer_name` | `orders` table (D1) | Yes — in `writeAuditLog` `after` payload | No |
| `customer_email` | `orders` table, passed to Stripe | Yes — in `writeAuditLog` `after` payload | No |
| `customer_phone` | `orders` table | Yes — in `writeAuditLog` `after` payload | No |
| `delivery_address_*` | `orders` table | Yes — in `writeAuditLog` `after` payload | No |
| `gift_message` | `orders` table | Yes — in `writeAuditLog` `after` payload | No |

**All PII fields are written verbatim to the audit log.** The `writeAuditLog` call passes the full order row as the `after` payload. This means every order creation writes the customer's full name, email, phone, and delivery address into the audit log table. If the audit log is ever queried for debugging, monitoring, or exported for incident analysis, it contains full customer PII without redaction.

**Data retention:** No retention policy is enforced on the `orders` table or the audit log. Both tables grow indefinitely.

### C9. Secrets Handling

- `STRIPE_SECRET_KEY` is accessed as `c.env.STRIPE_SECRET_KEY` (Cloudflare Worker secret binding). It is passed directly to `createStripeCheckoutSession()` and used as the `Authorization: Bearer` header. It is not logged.
- `HMAC_SHARED_SECRET` is accessed by `withAuthHmac` middleware. Not logged.
- No secrets appear in error responses or log payloads.

### C10. Edge / Runtime Exposure

- `coreRoutes.ts` runs in the Cloudflare Workers runtime. All APIs used (`crypto.randomUUID()`, `fetch()`, `URLSearchParams`, `new URL()`, `new Date()`) are Web Standard APIs. No Node.js APIs are used. Cloudflare-safe.
- `checkout/create/route.ts` is marked `export const runtime = "nodejs"` — it runs in the Pages Node.js runtime (not edge). The in-memory rate limit `Map` is therefore instance-local and not shared.

### C11. Multi-Tenant Leakage

No multi-tenant data model exists. All orders are under a single tenant. No cross-customer data leakage risk is present in this handler. Collection prices are read from a shared DB and there is no customer-scoped pricing.

### C12. Abuse Vectors

| Vector | Risk | Current Control |
|--------|------|-----------------|
| Enumerate valid collection IDs via 400 vs 404 response differences | Low — collection UUIDs are not guessable | None |
| Submit a large number of low-effort orders (spam/fraud) | Medium — ties up delivery slots, creates fake demand | Global 60/min rate limit only |
| Set `success_url` to attacker domain | **High** — post-payment redirect hijack | None |
| Submit zero-price collections (free checkout) | Low — only if Stripe allows AUD $0 sessions | Not blocked at the handler level; Stripe will reject zero-amount sessions |
| Submit `collection_id` for archived/inactive collections | Medium — prices may be stale; collections removed from storefront are still orderable | No visibility filter on collection SELECT |
| Submit `delivery_date` far in the future | Low | No maximum date enforced |
| Submit a gift message or customer note of arbitrary length | Low-medium — D1 TEXT columns accept unlimited length; large inputs waste storage | No max length enforcement |

---

## D. Observability and Operations

### D1. Logging Completeness

| Event | Logged | Level | Correlation ID |
|-------|--------|-------|---------------|
| Successful order creation | Yes — `logAction` + `writeAuditLog` | `info` | Yes |
| Order D1 INSERT failure | Yes — `fail()` returns 500; `logAction` not explicitly called on this path | — | Partial |
| order_items batch failure | No — the try/catch is absent around the order_items batch insert | — | No |
| Stripe session creation failure | No explicit log — Stripe failure is silently swallowed; order is left as `manual/pending` | — | No |
| Validation failure | No — `fail()` returns 400 but no `logAction` call precedes it | — | No |
| Rate limit exceeded (worker) | Yes — logged by `withRateLimit` middleware | `warn` | Yes |

**Gap:** If Stripe fails, there is no log event. An operator monitoring the system has no way to know that orders are being created but failing to attach payment sessions, unless they query the DB directly for `payment_provider = 'manual'` orders with `status = 'pending'`.

**Gap:** Validation failures (missing fields, bad delivery date) are not logged. Under normal operation this is acceptable, but under an abuse scan these errors would be silent.

### D2. Error Handling

- The order D1 INSERT is wrapped in try/catch and returns a structured 500 on failure.
- The order_items batch INSERT is **not wrapped in try/catch**. An exception here would propagate as an unhandled rejection and likely produce a 500 with no structured error body.
- `createStripeCheckoutSession()` returns `{ ok: false, ... }` on non-2xx Stripe responses — callers check `stripe.ok`. The handler continues silently if Stripe fails, returning the order with `payment_provider = 'manual'` and `payment_url = null`. This is intentional fallback behaviour, but it is not logged.
- The re-fetch of the order after creation (`SELECT * FROM orders WHERE id = ?`) is not error-handled. If it fails (e.g. replication lag in D1), the response returns `order: null` with a 201.

### D3. Retry Logic

- The Stripe `Idempotency-Key: checkout_session:{orderId}` header is set on the Stripe API call. If the Worker retries the Stripe call with the same `orderId`, Stripe returns the same session — correct.
- However, if the Worker itself is retried (Cloudflare retry on transient failure), the D1 `INSERT INTO orders` will fail with a duplicate primary key error, and the handler will return 500 rather than detecting it as idempotent and returning the existing order.
- There is no `ON CONFLICT DO NOTHING` or `INSERT OR IGNORE` on the orders table.

### D4. Performance Hotspots

| Operation | D1 Round Trips | Notes |
|-----------|---------------|-------|
| `tableExists("orders")` | 1 | `sqlite_master` read |
| `tableExists("collections")` | 1 | `sqlite_master` read |
| `getTableColumns("orders")` | 1 | `sqlite_master` read |
| `getTableColumns("order_items")` | 1 | `sqlite_master` read (inside `if` block) |
| `tableExists("order_items")` | 1 | `sqlite_master` read |
| `getDeliveryQuote()` | 1 | `delivery_zones` SELECT |
| Collections SELECT | 1 | `collections WHERE id IN (...)` |
| Orders INSERT | 1 | |
| Order items BATCH INSERT | 1 | D1 batch |
| Stripe API call | 0 (external fetch) | Network latency; not D1 |
| Orders UPDATE (payment fields) | 1 | |
| Orders re-SELECT | 1 | |
| **Total D1 operations** | **~10–11** | Before Stripe call |

Eleven D1 operations per checkout is high. Five of them are `sqlite_master` reads that could be eliminated with a module-level schema cache.

### D5. Failure Scenarios

| Scenario | Current Behaviour | Acceptable? |
|----------|-------------------|-------------|
| D1 unavailable at order INSERT | 500 returned; no order created | Yes |
| D1 insert succeeds, order_items batch fails | Order created with no line items; 500 not returned (unhandled rejection) | **No** |
| Stripe API times out | Order created as `manual/pending`, `payment_url = null` returned; not logged | Partial — needs logging |
| Stripe returns error response | Same as timeout; order is `manual/pending` | Partial |
| `payment_reference` UPDATE fails | Order has `manual` provider despite valid Stripe session; Stripe webhook still completes later | Survivable but confusing |
| Worker times out before completing | Partial state depending on which step completed | **No** — no cleanup or compensation |
| Collection deleted between cart build and order creation | Collection not found in `collectionMap`, 400 returned, no order created | Yes |
| Stripe session URL missing in response | 503 returned by storefront; order already created in worker | **No** — orphan order |

---

## E. Documentation Gaps

### E1. Architecture Doc Updates Required (`docs/ARCHITECTURE.md`)

- The checkout flow sequence (storefront → worker → Stripe) should be documented with the two-step write pattern and its atomicity limits.
- The `PUBLIC_PATHS` allowlist and `findRouteDoc` auth skip logic should be documented as a known architectural decision and its risks noted.
- The in-memory rate limiter on the storefront should be noted as an edge-local control, not a platform-level control.

### E2. Security Doc Updates Required (`docs/SECURITY.md`)

- Add a section on `success_url` / `cancel_url` validation requirement (currently absent).
- Document that audit logs contain unredacted PII and state the policy decision.
- Document the Stripe idempotency strategy and its retry gap.
- Note the `findRouteDoc` bypass risk and its verification status.

### E3. Database Doc Updates Required (`docs/DATABASE_DESIGN.md`)

- Document the duplicate address columns (`delivery_*` vs `address_*`) as legacy drift pending cleanup.
- Document the duplicate pricing columns in `order_items` (`unit_price` / `unit_price_cents`, `line_total` / `line_total_cents`) as legacy fields.
- Document `total_amount` as a legacy alias for `total_cents`.
- Add a note that `orders` and audit log tables have no enforced retention policy.

---

## F. 500 LOC Assessment

**Primary file LOC:** 4,372
**Violation:** **Yes — exceeds 500 LOC by 3,872 lines.**

`src/index.ts` is also 2,549 LOC — a second simultaneous violation.

### Responsibilities Mixed in `coreRoutes.ts`

The file currently owns all of the following concerns:

1. Type definitions (`CheckoutCartItemInput`, `CreateOrderInput`, `RequestMeta`)
2. Helper functions: `normalizeSlug`, `normalizeTags`, `isValidIsoDateOnly`, `centsFromCollection`, `validateCreateOrderInput`, `getMeta`, `ok`, `fail`, `toStatusCode`
3. Stripe integration: `createStripeCheckoutSession`
4. Response / logging utilities: `logAction`, `writeAuditLog`
5. Schema utilities: `tableExists`, `getTableColumns`
6. Delivery domain: `computeEarliestDeliveryDate`, `normalizeAuState`, `getDeliveryQuote`
7. Order domain: `createOrderHandler`, `listOrdersHandler`, `getOrderHandler`, `updateOrderHandler`, `patchOrderStatusHandler`, `refundOrderHandler`, `deleteOrderHandler`
8. Collection domain: create, update, delete, reorder handlers
9. Gift domain: create, update, delete, media handlers
10. Hero slides domain
11. Delivery zones domain
12. Newsletter domain
13. AI suggest domain (collections, gifts, inventory)
14. Settings domain
15. Audit log domain
16. All Hono route registrations

### Proposed Split Plan

| Proposed File | Responsibility | LOC Estimate |
|--------------|---------------|--------------|
| `src/routes/orders.ts` | All order handlers + order-specific types + `validateCreateOrderInput` + `createStripeCheckoutSession` + `centsFromCollection` | ~300 |
| `src/routes/collections.ts` | All collection + gift + media handlers + `normalizeSlug` + `normalizeTags` | ~500 |
| `src/routes/delivery.ts` | Delivery zones handlers + `computeEarliestDeliveryDate` + `normalizeAuState` + `getDeliveryQuote` | ~150 |
| `src/routes/ai.ts` | AI suggest handlers for collections, gifts, inventory | ~150 |
| `src/routes/admin.ts` | Hero slides, settings, newsletter, audit log handlers | ~200 |
| `src/lib/schemaCache.ts` | `tableExists`, `getTableColumns` — module-level cache | ~60 |
| `src/lib/responseHelpers.ts` | `ok`, `fail`, `toStatusCode`, `getMeta` | ~50 |
| `src/lib/logging.ts` | `logAction`, `writeAuditLog` | ~80 |
| `src/routes/index.ts` | Imports all route modules, calls their registration functions, exports single `registerRoutes` | ~50 |

**Total estimated LOC after split:** ~1,540 across 9 files. Average 170 LOC per file.

### Extraction Steps (incremental)

1. **Extract `src/lib/responseHelpers.ts`** — `ok`, `fail`, `toStatusCode`, `getMeta`. Zero business logic. Zero risk. Update all imports.
2. **Extract `src/lib/schemaCache.ts`** — `tableExists`, `getTableColumns`. Add module-level `Map` cache keyed by table name. Risk: cache must be invalidated on migration. Acceptance criteria: all callers use cached versions; no `sqlite_master` reads per-request in production.
3. **Extract `src/lib/logging.ts`** — `logAction`, `writeAuditLog`. Acceptance criteria: all route handlers import from this module.
4. **Extract `src/routes/delivery.ts`** — All delivery-related handlers and helpers. Low coupling. Acceptance criteria: delivery routes work identically in production after extraction.
5. **Extract `src/routes/orders.ts`** — Order handlers + Stripe session creation. High-value extraction. Acceptance criteria: all order integration tests pass. Risk: Stripe session creation references env bindings; ensure binding type is preserved.
6. **Extract remaining domains** — `collections.ts`, `ai.ts`, `admin.ts`.

**Risk notes:** The split itself carries no schema or API contract changes. The risk is import errors or missed references during extraction. Each step should be followed by a full build verification and a smoke test of the extracted routes.

**Rollback notes:** Each extraction step is independently reversible by moving code back to `coreRoutes.ts`. Git history makes this trivial. No migration is required.

---

## G. Improvement Backlog

### Fixes Applied (2026-03-01)

The following items were implemented in the same session as the review. All changes are in commit `00ffdfb` in `olive_and_ivory_api`.

| ID | Title | Implementation |
|----|-------|---------------|
| REVIEW-001-001 | Register POST on `/api/orders` in route registry | `apiRouteRegistry.ts` — methods updated to `["GET", "POST"]`; purpose, request_example and notes updated |
| REVIEW-001-002 | Validate `success_url`/`cancel_url` before passing to Stripe | `isAllowedRedirectUrl()` added; enforces HTTPS + `SITE_BASE_URL` hostname match + RFC-1918 block; called before Stripe session creation |
| REVIEW-001-003 | Email format validation | `validateCreateOrderInput` — regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` added; malformed email returns 400 `validation_error` |
| REVIEW-001-004 | Max-length enforcement for all string order fields | `ORDER_FIELD_MAX_LENGTHS` constant added; all fields checked in `validateCreateOrderInput`; cart size capped at 20 items |
| REVIEW-001-005 | order_items batch INSERT wrapped in try/catch | Failure deletes orphan order via compensating DELETE, logs `orders.create.items_failed`, returns 500 `order_items_insert_failed` |
| REVIEW-001-006 | Log Stripe session creation failures | `warn`-level `orders.stripe.session_failed` event logged with `stripe_status` and `stripe_error` before falling back to manual/pending |
| REVIEW-001-007 | Active/visible filter on collection SELECT | `AND status = 'active'` added to collection SELECT; error code changed to `collection_unavailable`; collection ID no longer leaked in error message |
| REVIEW-001-008 | Module-level schema cache | `_tableExistsCache` and `_tableColumnsCache` Maps at module scope; `tableExists` and `getTableColumns` cache on first call, valid for isolate lifetime |
| REVIEW-001-010 | Redact PII from audit log order payloads | `ORDER_PII_FIELDS` set + `redactOrderPii()` helper; `writeAuditLog` applies redaction to `before_json`/`after_json` for order entities |
| REVIEW-001-013 | Max delivery_date (12 weeks) | `MAX_DELIVERY_WEEKS = 12` constant; delivery date >12 weeks returns 400 `validation_error` |
| REVIEW-001-014 | AEST timezone Sunday check | `Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", weekday: "long" })` replaces `getUTCDay()` in both `createOrderHandler` and `computeEarliestDeliveryDate` |
| REVIEW-001-016 | Reject $0 orders | `totalCents <= 0` check added after fee calculation; returns 400 `validation_error` before any D1 writes |

### Remaining Backlog

| ID | Priority | Title | Effort | Owner | Acceptance Criteria | Risk |
|----|----------|-------|--------|-------|---------------------|------|
| REVIEW-001-007 | **P1** | Add active/visible filter to collection SELECT in order creation (`WHERE id IN (...) AND status = 'active'`) | S | — | Archived collections cannot be ordered; cart with inactive collection returns 400 | None after confirming all active collections have `status = 'active'` |
| REVIEW-001-008 | **P1** | Replace per-request `tableExists` / `getTableColumns` with a module-level schema cache | M | — | All `sqlite_master` queries happen once at Worker startup; subsequent requests use cached results; cache is invalidated on Worker deployment | Low — schema can only change via migration, which restarts the Worker |
| REVIEW-001-009 | **P1** | Add idempotency handling to order creation: `ON CONFLICT(id) DO NOTHING` or detect duplicate and return existing order | M | — | Retried requests with the same `orderId` return the existing order and Stripe session rather than a 500 | Requires careful handling to avoid returning a stale `checkout_url` that has expired |
| REVIEW-001-010 | **P1** | Redact PII fields from audit log `after` payload in `writeAuditLog` for order events | M | — | `customer_email`, `customer_phone`, `delivery_address_*` are masked (first 3 chars + `***`) in audit log payloads; full data retained in `orders` table | Data retention policy decision required |
| REVIEW-001-011 | **P2** | Remove duplicate legacy address columns from `orders` table (`address_line1`, `address_suburb`, `address_state`, `address_postcode`, `address_country`) | L | — | Migration removes columns; all code reads from `delivery_*` columns only; D1 migration tested on staging first | Breaking if any consumer reads `address_*` columns directly; requires full audit of callers |
| REVIEW-001-012 | **P2** | Remove duplicate pricing columns from `order_items` (`unit_price`, `line_total`) | L | — | Migration removes legacy columns; all code uses `_cents` variants | Same as above — requires caller audit |
| REVIEW-001-013 | **P2** | Enforce max `delivery_date` (e.g. max 12 weeks in advance) | S | — | Delivery date more than 12 weeks out returns 400 | Business decision required on max window |
| REVIEW-001-014 | **P2** | Replace Sunday delivery check from UTC to AEST/AEDT (`Australia/Sydney` timezone) | S | — | `getUTCDay() === 0` replaced with timezone-aware day check; Sunday in AEST is correctly blocked regardless of UTC offset | None — purely a correctness fix |
| REVIEW-001-015 | **P2** | Split `coreRoutes.ts` into domain-specific modules per split plan in Section F | L | — | All routes function identically after split; file sizes are all ≤ 500 LOC; CI build passes; no API contract changes | Medium — large refactor; should be done in small incremental PRs per extraction step |
| REVIEW-001-016 | **P2** | Enforce a delivery fee minimum — reject $0 total orders at the handler level | S | — | `total_cents <= 0` returns 400 unless explicitly configured as "free" | Business decision required |
| REVIEW-001-017 | **P2** | Define and enforce a data retention policy for `orders` and audit log tables | M | — | Policy documented in `docs/SECURITY.md`; D1 scheduled cleanup job created or manual procedure documented | None immediately — operational task |

---

## H. Definition of Done — This Review

- [x] All sections A–G completed
- [x] All P0 findings have an immediate action note (REVIEW-001-001: verify registry; REVIEW-001-002: URL validation)
- [x] REVIEW-001-001 through REVIEW-001-008, 010, 013, 014, 016 fixed and deployed (`olive_and_ivory_api`)
- [x] REVIEW-001-017 documented in `docs/SECURITY.md`
- [x] Tasks added to `docs/TASKS.md` (REVIEW-001-001 through REVIEW-001-017)
- [x] REVIEW-001-009 deferred: `orderId` is generated per-request; duplicate INSERT cannot occur without a client-supplied idempotency key. Redesign required.
- [x] REVIEW-001-011, 012 deferred: migration required; pending staging verification
- [x] REVIEW-001-015 deferred: incremental refactor; tracked in `docs/TASKS.md`
- [x] Documentation gaps identified (Section E)
- [x] 500 LOC violation documented with full split plan (Section F)
- [x] Review record committed to docs/reviews/

---

*Next review: Day 002 — `POST /api/stripe/webhook` — Stripe signature verification, event handling, order fulfilment trigger.*
