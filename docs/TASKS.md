# Outstanding Tasks & Improvements

> Last updated: 2026-03-08
> Owner: repo agent / Yuri
> Scope: Task backlog for the Olive & Ivory Gifts project

Tasks follow the standard template below. Tick items off as they are completed.
Add new tasks via `npx tsx scripts/docs_writer.ts add-task` (see [scripts/docs_writer.ts](../scripts/docs_writer.ts)).

**Template:**
```
- [ ] **<Task title>**
  - **Repo(s):** <repo>
  - **Area:** <area>
  - **Why:** <short reason>
  - **Acceptance:**
    - <done condition>
  - **Priority:** <high|medium|low>
  - **Notes:** <optional refs>
```

---

## To Do

### AI Readiness Program

- [x] **Execute AI readiness backlog (cross-repo)** · AI-READINESS-001
  - **Repo(s):** api-middleware, olive_and_ivory_api, olive_and_ivory_gifts, admin_olive_and_ivory_gifts
  - **Area:** Architecture / CI / Testing / DX
  - **Why:** Establishes enforceable guardrails for AI-assisted coding (placement, testing, contracts, file size, PR evidence).
  - **Acceptance:**
    - P0 tasks in [AI_READINESS_TASKS.md](./AI_READINESS_TASKS.md) complete
    - CI and PR template checks active in all repos
  - **Priority:** high
  - **Status:** COMPLETE (2026-03-11) — Added AI rule enforcement scripts, PR template validation, and CI gating updates across all repos.

### High Priority

#### API Middleware

- [x] **Remove HMAC debug logging** · DEBUG-HMAC-001
  - **Repo(s):** api-middleware
  - **Area:** Security / Cleanup
  - **Why:** Temporary `[HMAC_DEBUG]` console.error added to `src/runtime/middlewares/auth.ts` to diagnose signature mismatches. Must be removed after diagnosis.
  - **Acceptance:**
    - Debug logging block removed from `auth.ts`
    - Rebuild and redeploy API worker with clean dist
  - **Priority:** high

#### API Worker

- [x] **Split `index.ts` below 500 lines** · LOC-API-001
  - **Repo(s):** olive_and_ivory_api
  - **Area:** DX / Architecture
  - **Why:** `index.ts` is 817 lines after the March 2026 extraction. It still contains route registration, scheduled handler, environment validation, and middleware wiring in one file.
  - **Acceptance:**
    - Remaining route registration and scheduled handler moved to dedicated modules
    - `index.ts` becomes a thin bootstrap/wiring file ≤150 lines
    - TypeScript compiles cleanly; all routes smoke-tested after extraction
  - **Priority:** high

- [x] **Split `logs.ts` below 500 lines** · LOC-API-002
  - **Repo(s):** olive_and_ivory_api
  - **Area:** DX / Architecture
  - **Why:** `logs.ts` is 726 lines — 1.5× the limit. Log route handlers and any aggregation/query helpers should be in separate files.
  - **Acceptance:**
    - Query helpers and route handlers separated into focused modules
    - Each module ≤500 lines
  - **Priority:** high

- [x] **Add request timeout handling on all outbound fetch calls**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Infra
  - **Why:** No `AbortController` timeout on calls to Stripe, OpenAI, Google Places, or Brevo. A slow upstream hangs the Worker isolate until Cloudflare's hard limit.
  - **Acceptance:**
    - All outbound `fetch()` calls wrapped with `AbortController` and a configurable timeout (default 10s)
    - Timeout errors classified and returned as 504 with structured error body
  - **Priority:** high
  - **Status:** COMPLETE (2026-03-07)
    - Wrapped fetchWithTimeout on Stripe (15s), OpenAI (30s), Brevo (10s), Photon (10s) calls across: stripe.ts, orderFinanceRoutes.ts, ai.ts, entity-ai-suggest.ts, deliveryOpsRoutes.ts, observability.ts, shipping.ts
    - Note: orderDomain.ts already had timeout via AbortController parameter

- [x] **Add idempotency handling to order creation**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Infra
  - **Why:** Needs redesign — `orderId = crypto.randomUUID()` is generated per-request, so Worker retries create new UUIDs rather than colliding. The duplicate-INSERT scenario described requires a client-supplied idempotency key. Proposed: add `idempotency_key` field to checkout request, add `UNIQUE` constraint to D1, implement upsert + return-existing-order logic.
  - **Acceptance:**
    - Caller supplies an `idempotency_key` in the request body (e.g. cart session ID)
    - `orders` table has `UNIQUE(idempotency_key)` constraint
    - Duplicate key within TTL window returns the existing order + Stripe session (or re-creates an expired session)
  - **Priority:** high
  - **Notes:** REVIEW-001-009 — Day 001 review; deferred pending design
  - **Status:** COMPLETE (2026-03-08) — Implemented D1 column with UNIQUE constraint, storefront passing UUID idempotency_key computed from payload, matching existing session successfully recreating stripe URL.

#### Admin

- [x] **Split `orders/client.tsx` (orders list) into focused modules** · LOC-ADM-001
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** The orders list client component is 1,073 lines — 2.1× the limit. It contains the full page, 6 modal components (CancelModal, RefundModal, DeleteModal, HardDeleteConfirmModal, StockActionModal, RestockItemsModal), and all page-level state. Modals especially belong in separate files.
  - **Acceptance:**
    - Modal components extracted to `src/app/(dashboard)/orders/modals/` (one file per modal or a grouped `order-modals.tsx`)
    - Page-level state/handlers optionally extracted to a hook
    - `client.tsx` reduced to ≤500 lines with focused page responsibility
  - **Priority:** high

- [x] **Split `InventoryListPage.tsx` below 500 lines** · LOC-ADM-002
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** `InventoryListPage.tsx` is 791 lines — 1.6× the limit. Contains table, filters, inline editor, and modals in one component.
  - **Acceptance:**
    - Extracted sub-components or hooks reduce the file to ≤500 lines
    - No new file exceeds the limit
  - **Priority:** high

- [x] **Split `CollectionMetadataForm.tsx` below 500 lines** · LOC-ADM-003
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** `CollectionMetadataForm.tsx` is 785 lines — 1.6× the limit. Mixes form sections, AI assist, SEO fields, and preview logic.
  - **Acceptance:**
    - Focused sub-sections (AI, SEO, preview) extracted to child components or hooks
    - Parent file reduced to ≤500 lines
  - **Priority:** high

- [x] **Split `systemHealth.ts` below 500 lines** · LOC-ADM-004
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** `systemHealth.ts` is 774 lines — 1.5× the limit. Mixes multiple system health check categories in one module.
  - **Acceptance:**
    - Health check logic split by domain (e.g. DB checks, API checks, storage checks)
    - Each module ≤500 lines
  - **Priority:** high

- [ ] **Migrate admin from `@cloudflare/next-on-pages` to `@opennextjs/cloudflare`**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Infra / DX
  - **Why:** `@cloudflare/next-on-pages` is deprecated. The storefront already uses `@opennextjs/cloudflare` (v1.16.5). Using two different adapters adds maintenance cost and risks divergence on Cloudflare Pages features.
  - **Acceptance:**
    - `@cloudflare/next-on-pages` removed from `package.json`
    - `@opennextjs/cloudflare` added and configured
    - Admin site builds and deploys cleanly to Cloudflare Pages
    - Login, collections, gifts, and orders pages verified working
  - **Priority:** high

- [ ] **Fix Hero Preview blank on gift edit page**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Images / UX
  - **Why:** Primary media exists but Hero Preview stays blank/grey — root cause is initialMedia prop not syncing into GiftEditorForm mediaItems state after async load
  - **Acceptance:**
    - Hero preview renders when primary media exists
    - Fallback empty state shown when no media
    - getPrimaryPreviewKey handles empty variants_json without returning null
    - onError handler shows empty state on 404/403
  - **Priority:** high

#### Storefront

- [x] **Split `CheckoutPageClient.tsx` into focused checkout sections** · LOC-SF-001
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** At 1,235 lines, `CheckoutPageClient.tsx` is 2.5× the 500 LOC limit. It mixes address form, delivery date selection, Stripe initiation, order confirmation, and cart rendering in a single component.
  - **Acceptance:**
    - Split into focused child components or hooks (e.g. `AddressSection`, `DeliveryDateSection`, `CheckoutSummary`, `useCheckoutState`)
    - No single new file exceeds 500 lines
    - Existing checkout flow and Stripe integration unchanged
  - **Priority:** high
  - **Status:** COMPLETE (2026-03-07)
    - Created 12 focused files: `australianAddress.ts`, 4 custom hooks (useCheckoutForm, useDeliveryRules, useDeliveryQuote, useAddressAutocomplete), 5 UI components (OrderSummary, DeliveryDetailsSection, BillingDetailsSection, AddressSection, ConfirmAddressModal), CheckoutFields primitives, and refactored orchestrator (~120 lines)

- [x] **Implement `/contact` page form submission**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** CX
  - **Why:** The contact page renders a form but has no submission handler. Customers expecting to send an enquiry get no feedback and no message is delivered.
  - **Acceptance:**
    - Form submits to an API route (Brevo, email webhook, or similar)
    - Success and error states shown to user
    - Rate limited at middleware level
  - **Priority:** high
  - **Status:** COMPLETE (2026-03-11)
    - Contact handler POST /api/contact sends via Brevo transactional email. Rate limited at 3 req/60s per IP using D1-backed api_request_rate_limits table.

- [ ] **Replace remaining browse page console errors with structured event logs**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** Observability / Browse
  - **Why:** Browse result logging now goes through `event_logs`, but the server-rendered browse page still uses raw `console.error` for `browse.page.error` and unbiased-facets failures. That keeps part of browse diagnostics outside the core log pipeline.
  - **Acceptance:**
    - `browse.page.error` writes to `event_logs` via the existing `writeEventLog` helper
    - unbiased-facets fetch failures are either logged structurally or intentionally suppressed
    - no raw browse-related `console.error` remains in the browse page path
  - **Priority:** high


#### All Repos

- [ ] **Publish `api-middleware` to npm**
  - **Repo(s):** api-middleware, olive_and_ivory_api, olive_and_ivory_gifts, admin_olive_and_ivory_gifts
  - **Area:** DX / Infra
  - **Why:** All three apps depend on `api-middleware` via a git ref. Git deps are not scanned by `npm audit`, have slower installs, and make version bumps manual and error-prone.
  - **Acceptance:**
    - Package published to npm (private scope `@harloldholt/api-middleware` or public)
    - All three consumer `package.json` files updated to npm ref
    - `npm audit` now covers the package
  - **Priority:** high

- [x] **Make order stock restore + status UPDATE atomic** · REVIEW-007-002
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Data Integrity
  - **Why:** In `patchOrderStatusHandler`, `restoreOrderInventoryStock` runs N serial upserts before the `UPDATE orders SET status` executes. If the UPDATE fails after stock is restored, stock is permanently incremented but the order is not cancelled. A second cancel attempt will restore stock again.
  - **Acceptance:**
    - Stock restoration and order UPDATE execute atomically: either both succeed or neither is applied
    - If using `db.batch()`: verify D1 batch semantics guarantee rollback on partial failure, or use a pre-check-then-batch approach that only runs if both can succeed
    - `order_stock_restored` flag only set on confirmed order UPDATE success
    - Failure path tested: if UPDATE throws, stock remains unchanged
  - **Priority:** high
  - **Notes:** REVIEW-007-002 — Day 007 review. `restoreOrderInventoryStock` is at coreRoutes.ts:782–815.
  - **Status:** COMPLETE (2026-03-08) — Refactored `restoreOrderInventoryStock` and `writeOffOrderStock` to return arrays of `D1PreparedStatement` instead of executing sequentially. Bundled them into a `db.batch()` execution alongside the `UPDATE orders` statement inside `patchOrderStatusHandler` and `updateOrderHandler` for transaction atomicity.

- [x] **Fix `PUT /orders/:id` state machine bypass** · REVIEW-007-003
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Data Integrity / Security
  - **Why:** `updateOrderHandler` (PUT /orders/:id) accepts a `status` field but does not enforce the same state machine guards as `patchOrderStatusHandler`. A delivered or cancelled order can have its status regressed to any other value via PUT.
  - **Acceptance:**
    - `updateOrderHandler` enforces identical terminal state guards: `delivered` orders cannot be transitioned to any other status; `cancelled` orders cannot be changed
    - Attempt to regress via PUT returns 409 with `invalid_transition` error code
    - Existing PATCH behaviour unchanged
  - **Priority:** high
  - **Notes:** REVIEW-007-003 — Day 007 review. `updateOrderHandler` is at coreRoutes.ts:4007–4080.
  - **Status:** COMPLETE (2026-03-08) — Added strict status guards to `updateOrderHandler` identical to `patchOrderStatusHandler` restricting mutations out of terminal `delivered` and `cancelled` states.

- [x] **Wrap `logAction` in patchOrderStatusHandler with try/catch** · REVIEW-007-004
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Reliability
  - **Why:** `logAction` is called without a surrounding try/catch in `patchOrderStatusHandler`. If `event_logs` is unavailable, an unhandled rejection propagates and returns 500 — even after the order status was already successfully updated. `writeAuditLog` immediately after has a catch block; `logAction` does not.
  - **Acceptance:**
    - `logAction` call in `patchOrderStatusHandler` wrapped in try/catch
    - Failure logs `console.warn` and does not propagate as 500 on a successful status update
    - Same fix applied to any other route handlers in `coreRoutes.ts` where `logAction` is called outside a try/catch after a successful write
  - **Priority:** high
  - **Notes:** REVIEW-007-004 — Day 007 review.
  - **Status:** COMPLETE (2026-03-08) — Wrapped `logAction` inside `patchOrderStatusHandler` in try/catch block.

---

### Medium Priority

#### Storefront

- [ ] **Fix and re-enable checkout address autocomplete**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** Checkout / UX
  - **Why:** Google Places autocomplete returns 502s (likely missing or misconfigured `GOOGLE_PLACES_SERVER_KEY` in Cloudflare Pages). Geocode fallback works but flashes "Address search unavailable" during typing. Autocomplete is currently disabled (`enabled: false` in `useAddressAutocompleteController` initial state). Needs: verify API key is set in Pages env, decide on keystroke vs blur trigger, revert temporary debug changes (wildcard `X-Goog-FieldMask` and `console.log` in `places/autocomplete/route.ts`).
  - **Acceptance:**
    - `GOOGLE_PLACES_SERVER_KEY` confirmed working in Cloudflare Pages
    - Autocomplete re-enabled with no flashing error messages
    - Debug wildcard field mask and console.log reverted
    - House number preserved in both Places and geocode results
  - **Priority:** medium
  - **Notes:** Disabled in commit dbfe235. Debug changes in commit 3b794b1.

- [ ] **Add `gallery_image_keys` column to `collections` table or remove from schema docs**
  - **Repo(s):** olive_and_ivory_gifts, docs
  - **Area:** Schema / Data
  - **Why:** `collections` table in D1 does not have a `gallery_image_keys` column but `DATABASE_DESIGN.md` lists it. The storefront query now uses `NULL AS gallery_image_keys` as a workaround. The column should either be added via migration (if gallery images are needed) or removed from the docs to reflect reality.
  - **Acceptance:**
    - If adding: migration adds `gallery_image_keys TEXT` to `collections`; storefront query updated to select `c.gallery_image_keys`; admin UI can populate it
    - If removing: `DATABASE_DESIGN.md` ERD and table notes updated; `NULL AS gallery_image_keys` workaround noted as permanent
  - **Priority:** medium
  - **Notes:** Root cause of silent query failure in `getCollectionVariantTiles` (fixed 2026-03-03 with NULL workaround)

#### AI Assist

- [ ] **Add schema caching strategy for AI suggest responses**
  - **Repo(s):** olive_and_ivory_api, admin_olive_and_ivory_gifts
  - **Area:** AI Assist
  - **Why:** Every AI suggest call fetches the output schema from the `ai_prompts` D1 table. Under high admin usage this adds per-request D1 reads. A short TTL cache would reduce latency and DB load.
  - **Acceptance:**
    - Schema fetched from D1 on cold start, cached in Worker memory with a 60s TTL
    - Cache invalidated when an admin updates the prompt via settings
    - Unit test covers cache hit and miss paths
  - **Priority:** medium

- [x] **Pin schema version per AI run in `gift_ai_runs` table**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** AI Assist
  - **Why:** `gift_ai_runs` records store `prompt_id` but not the schema version at time of the run. If the output schema is changed in `ai_prompts`, old runs become ambiguous — it is unclear whether a historical output conformed to the current or an older schema.
  - **Acceptance:**
    - `gift_ai_runs` table gains a `schema_version` or `prompt_version_hash` column (migration required)
    - API populates this field on every AI run insert
    - Admin AI run history view shows schema version
  - **Priority:** medium

- [ ] **Add token usage and retry count telemetry to AI run logs**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** AI Assist / Observability
  - **Why:** No visibility into OpenAI token consumption per run. This makes it impossible to audit costs, detect runaway prompts, or set sensible limits.
  - **Acceptance:**
    - `gift_ai_runs.input_tokens`, `output_tokens`, `total_tokens`, `retry_count` columns added
    - API populates these from OpenAI response metadata
    - Aggregate token usage visible in admin `/logs` metrics or a dedicated view
  - **Priority:** medium

- [ ] **Persist AI suggestion history per collection entity**
  - **Repo(s):** olive_and_ivory_api, admin_olive_and_ivory_gifts
  - **Area:** AI Assist
  - **Why:** AI runs are logged in `gift_ai_runs` for gifts but collection-level AI suggest history is not persisted. Admins cannot compare or revert to a previous suggestion.
  - **Acceptance:**
    - `collection_ai_runs` table created (or `ai_runs` generalised with `entity_type` column)
    - API persists every collection AI suggest call with input, output, model, and prompt version
    - Admin collection detail page shows last N AI suggestions with timestamps
  - **Priority:** medium

- [ ] **Add integration tests for AI output schema enforcement**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** AI Assist / Testing
  - **Why:** The API validates OpenAI output against a Zod schema, but there are no automated tests that exercise schema validation failure paths — a silent regression would reach admins.
  - **Acceptance:**
    - Tests cover: valid output passes, missing required field rejected, extra field stripped, wrong type coerced or rejected
    - Tests use a mocked OpenAI client (no real API calls in CI)
  - **Priority:** medium

#### API Worker

- [ ] **Split `coreRoutes.ts` into domain-scoped route files** · REVIEW-007-001
  - **Repo(s):** olive_and_ivory_api
  - **Area:** DX / Architecture
  - **Why:** At 4,835 lines, `coreRoutes.ts` is a single-file monolith — 9.7× the 500 LOC limit. It is slow to navigate, hard to review, and every PR touching any route risks merge conflicts across all domains.
  - **Acceptance:**
    - Shared helpers extracted first: `src/lib/routeUtils.ts`, `src/lib/orderHelpers.ts`, `src/lib/giftHelpers.ts`, `src/lib/collectionHelpers.ts`
    - Route handlers split into: `collections.ts`, `collectionGifts.ts`, `gifts.ts`, `giftMedia.ts`, `orders.ts`, `orderActions.ts`, `ai.ts`, `cms.ts`, `delivery.ts`, `newsletter.ts`
    - Each extracted module ≤500 LOC
    - `registerCoreRoutes` becomes a thin delegating entry point (~50 LOC)
    - `/api/` dual-registration preserved in every module
    - TypeScript compiles cleanly; all routes smoke-tested against staging D1 after each extraction step
  - **Priority:** high
  - **Notes:** REVIEW-007-001 — full split plan in `docs/reviews/2026-03-03-day007-PATCH-orders-id-status.md#F`. Original task REVIEW-001-015 in `docs/reviews/2026-03-01-day001-POST-api-orders.md#F`

- [x] **Add length limit to `reason` field on PATCH /orders/:id/status** · REVIEW-007-005
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Validation
  - **Why:** The `reason` field (written to `cancel_reason` column) has no length limit. An unbounded string is accepted by authenticated callers and written to D1.
  - **Acceptance:**
    - `reason` capped at 500 characters in `patchOrderStatusHandler`
    - Values exceeding the limit return 400 with a descriptive error before any DB write
  - **Priority:** medium
  - **Notes:** REVIEW-007-005 — Day 007 review.

- [x] **Batch `inventory_stock` upserts in `restoreOrderInventoryStock`** · REVIEW-007-006
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Performance / Reliability
  - **Why:** Stock restoration runs N serial `db.prepare(...).run()` calls in a loop. For orders with many line items, this is multiple sequential D1 round trips and can leave stock partially restored on mid-loop failure.
  - **Acceptance:**
    - Serial calls replaced with a single `db.batch(statements)` call
    - Semantics preserved: same rows updated with same quantities
    - Atomic: either all items restored or none (relying on D1 batch semantics)
  - **Priority:** medium
  - **Notes:** REVIEW-007-006 — Day 007 review. Also addresses atomicity partially (complement to REVIEW-007-002).

- [x] **Log 409 state transition rejections to `event_logs`** · REVIEW-007-007
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Observability
  - **Why:** When an invalid status transition is blocked (e.g. attempting to change a delivered order), no event log is written. Blocked transitions are not auditable.
  - **Acceptance:**
    - `logAction` called on 409 path with `level: "warn"` and `action: "orders.status_rejected"`
    - Payload includes `order_id`, `from_status`, `to_status`, and rejection reason
    - Call wrapped in try/catch so it does not affect response
  - **Priority:** medium
  - **Notes:** REVIEW-007-007 — Day 007 review.

- [x] **Replace `SELECT *` in order before/after reads with explicit column lists** · REVIEW-007-008
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Data Hygiene / PII
  - **Why:** `patchOrderStatusHandler` issues two `SELECT *` queries per request, returning all PII columns. Only status-relevant fields are needed; returning full PII unnecessarily expands the data surface returned to callers.
  - **Acceptance:**
    - `SELECT *` in before/after reads replaced with an explicit column list covering only fields required for the response and audit log
    - Admin UI response contract verified to be unaffected before any field is removed
  - **Priority:** medium
  - **Notes:** REVIEW-007-008 — Day 007 review.

- [ ] **Add OpenAI prompt length guard before sending to API**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** AI Assist / Security
  - **Why:** The `ai_prompts` schema allows up to 24,000 character fields, but there is no validation that the assembled prompt stays within OpenAI's context limit. An oversized prompt causes an opaque 400 from OpenAI.
  - **Acceptance:**
    - Total token estimate calculated before sending (character count proxy is acceptable)
    - Request rejected with a clear 422 error if over limit
    - Limit configurable via env var or prompt metadata
  - **Priority:** medium

- [x] **Require server-owned redirect allowlist for Stripe checkout URLs** · REVIEW-005-001
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Payments / Security
  - **Why:** Redirect validation currently falls back to request-supplied `site_base_url` when `SITE_BASE_URL` is unset. That weakens the trust boundary and allows signed callers to define their own Stripe redirect host.
  - **Acceptance:**
    - Redirect allowlist source is server-owned only (`SITE_BASE_URL` or explicit env allowlist)
    - `site_base_url` from request payload is ignored for allowlist decisions
    - Tests confirm a signed payload with attacker-controlled host is rejected
  - **Priority:** medium
  - **Notes:** Day 005 review — `createStripeCheckoutSession()`

- [x] **Preserve Stripe error object details in checkout session failures** · REVIEW-005-002
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Payments / Observability
  - **Why:** Current `stripe_upstream_error` extraction stringifies Stripe error objects, producing low-signal messages like `[object Object]` and obscuring root-cause analysis.
  - **Acceptance:**
    - Error parsing prefers `error.message`, `error.type`, `error.code`, and request ID fields when present
    - Event logs include structured Stripe failure context without leaking secrets
    - Checkout failure responses remain backward-compatible for callers
  - **Priority:** medium
  - **Notes:** Day 005 review — `createStripeCheckoutSession()`

#### Admin

- [x] **Add audit log to logout route** · REVIEW-003-009
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Observability / Security
  - **Why:** `POST /api/auth/logout` performs a session deletion with no audit log. Admin session terminations should be traceable.
  - **Acceptance:**
    - `auth.logout` event logged with `user_id`, first 8 chars of token hash, and IP address
  - **Priority:** medium
  - **Notes:** REVIEW-003-009 — Day 003 review

- [x] **Remove `debug` fields from `/api/auth/me` production response** · REVIEW-003-010
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Security
  - **Why:** `GET /api/auth/me` returns `debug: { has_access_header, access_email }` to all callers, leaking Cloudflare Access header information.
  - **Acceptance:**
    - `debug` block removed from the response, or gated behind `env.DEBUG_MODE === 'true'`
  - **Priority:** medium
  - **Notes:** REVIEW-003-010 — Day 003 review

- [x] **Implement or remove CSRF token in sessions table** · REVIEW-003-011
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Security / Auth
  - **Why:** `sessions.csrf_token` is generated and stored on every session creation but never read or validated. CSRF protection relies solely on `sameSite: 'lax'` cookie attribute. If cross-site protection is ever bypassed, there is no secondary defence.
  - **Acceptance:**
    - Decision documented: either implement CSRF token validation on all state-changing admin API routes, or remove the column and generation
    - If implementing: all POST/PUT/DELETE admin API routes validate `X-CSRF-Token` header against the session's stored token
    - If removing: D1 migration drops the column; `createSession` code updated
  - **Priority:** medium
  - **Notes:** REVIEW-003-011 — Day 003 review; M-effort if implementing across all admin routes

- [x] **Refactor Media panel to compact row layout**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Images / UX
  - **Why:** Large static 4:5 preview card wastes ~350px of vertical space even when no editing is happening; duplicates the hero preview already shown in the right-side panel
  - **Acceptance:**
    - Large static preview card removed from GiftMediaEditor
    - Compact row list with small thumbnails (max 80px height) replaces it
    - Inline expanded edit row appears on item activation with alt text, focal, crop controls
    - Add image button always visible; keyboard accessible expand/collapse
  - **Priority:** medium

- [x] **Split `useAiAssistFlow.ts` below 500 lines** · LOC-ADM-005
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** `useAiAssistFlow.ts` is 694 lines — 1.4× the limit. A single hook doing this much state management is hard to test and reason about.
  - **Acceptance:**
    - Logical sub-flows (prompt selection, request lifecycle, result handling) split into narrower hooks
    - `useAiAssistFlow` becomes a thin orchestrator ≤300 lines
  - **Priority:** medium

- [x] **Split `useInventoryEditorState.ts` below 500 lines** · LOC-ADM-006
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** `useInventoryEditorState.ts` is 686 lines — 1.4× the limit. A single hook handling this much editor state makes extraction and testing difficult.
  - **Acceptance:**
    - Editor concerns split into focused sub-hooks (e.g. form state, save logic, media handling)
    - No new file exceeds the limit
  - **Priority:** medium

- [x] **Audit and reduce medium-oversized admin pages** · LOC-ADM-007
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** The following admin pages exceed 500 lines without individual split tasks:
    - `(dashboard)/page.tsx` — 597 lines (dashboard home)
    - `(dashboard)/logs/page.tsx` — 561 lines
    - `components/system-health-widget.tsx` — 539 lines
    - `(dashboard)/orders/[id]/client.tsx` — 523 lines
    - `(dashboard)/gifts/page.tsx` — 509 lines
  - **Acceptance:**
    - Each file reviewed and either split to ≤500 lines or a justified exception documented
    - Extracted helpers/sub-components follow single-responsibility rule
  - **Priority:** medium

- [x] **Split GiftEditorForm into focused feature sections**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Editor UX / Maintainability
  - **Status:** COMPLETE (2026-03-06) — Extracted `giftEditorHelpers.ts`, `useGiftEditorSubmit.ts`, `useGiftFormState.ts`. Parent form reduced from 745 → 234 lines.

- [ ] **Add reusable sortable list pattern before introducing gift product drag-and-drop**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Editor UX / Reuse
  - **Why:** Gift product ordering currently uses explicit up/down controls. There is no existing drag-and-drop/sortable interaction pattern in admin, so adding one directly here would introduce a one-off UI pattern and violate the reuse rule.
  - **Acceptance:**
    - Existing sortable interaction patterns across admin are audited
    - A reusable sortable list component or hook is defined and adopted in at least 2 places
    - Gift product ordering is upgraded to drag-and-drop only after the shared pattern exists
  - **Priority:** medium
  - **Notes:** Current gift product ordering is functional and should remain on up/down controls until a shared sortable pattern is available.

- [ ] **Write Playwright tests for critical admin flows**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Testing
  - **Why:** `playwright.config.ts` exists but test coverage is unknown. Without automated tests, regressions in login and core CRUD are only caught manually.
  - **Acceptance:**
    - Tests cover: login / logout, create collection, create gift, view order
    - Tests run in CI on PRs to main
    - Failing tests block merge
  - **Priority:** medium

#### Storefront

- [x] **Split `data.ts` below 500 lines** · LOC-SF-002
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** `src/lib/data.ts` is 702 lines — 1.4× the limit. Mixes multiple data-fetching concerns for different page types.
  - **Acceptance:**
    - Data fetching helpers split by domain (e.g. `collections.ts`, `gifts.ts`, `homepage.ts`)
    - Each module ≤500 lines
  - **Priority:** medium

- [x] **Audit and reduce medium-oversized storefront lib files** · LOC-SF-003
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** DX / Architecture
  - **Why:** The following storefront files exceed 500 lines without individual split tasks:
    - `src/lib/orders.ts` — 573 lines
    - `src/lib/browse.ts` — 522 lines
  - **Acceptance:**
    - Each file reviewed and either split to ≤500 lines or a justified exception documented
  - **Priority:** medium
  - **Status:** COMPLETE (2026-03-07)
    - `orders.ts`: Split validation helpers into `orderValidation.ts` (removed ~105 lines). Now 467 lines. Removed duplicate state mapping, imported from `australianAddress.ts`.
    - `browse.ts`: 522 lines documented as justified exception. Single-concern SQL query builder with three fallback modes (gifts/variants/collections). Splitting would reduce clarity; the complex conditional logic across modes is tightly coupled.

- [ ] **Avoid duplicate browse queries for unfiltered facets**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** Performance / Browse
  - **Why:** `/browse` currently calls `getBrowseItems(...)` once for results and a second time for unbiased facets whenever filters are active. This doubles DB work for a common filtered path.
  - **Acceptance:**
    - page load performs one browse query for the main result set
    - unbiased facets are derived without a second full query OR are fetched through a cheaper dedicated facet query
    - filtered browse latency is measurably lower than the current dual-query path
  - **Priority:** medium

- [ ] **Refactor `BrowseInteractive` into smaller feature modules**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** DX / Browse
  - **Why:** `BrowseInteractive.tsx` is carrying filter orchestration, chip rendering, pagination controls, and result rendering in one large client component. It already has dead code warnings (`BrowseItem` import, `hasActiveFilters`) and is harder to maintain safely.
  - **Acceptance:**
    - `BrowseInteractive.tsx` is split into smaller focused components/hooks
    - dead code warnings are removed
    - no single new component exceeds the 500-line guardrail
    - browse behavior remains unchanged
  - **Priority:** medium

- [ ] **Tune browse filter commit behavior and debounce UX**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** UX / Browse
  - **Why:** The current 1000ms debounce on search/filter updates is conservative and can make the interface feel sluggish. The commit behavior should be reviewed so text search, checkbox filters, and price changes feel responsive without spamming route updates.
  - **Acceptance:**
    - debounce timing reviewed and reduced where appropriate
    - immediate vs deferred filter commits are intentional per control type
    - route updates remain stable and do not regress back/forward navigation
  - **Priority:** medium

- [ ] **Align React version between storefront and admin**
  - **Repo(s):** olive_and_ivory_gifts, admin_olive_and_ivory_gifts
  - **Area:** DX / Infra
  - **Why:** Storefront uses React 19.1.5, admin uses 19.2.4. Minor version skew is low risk but should be resolved to simplify upgrade tracking.
  - **Acceptance:**
    - Both repos pinned to the same React + React-DOM version
    - Both build cleanly after alignment
  - **Priority:** medium

- [ ] **Implement or clearly stub the `/account` page**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** CX
  - **Why:** The account page is a placeholder. Customers who navigate to it see an incomplete page with no guidance.
  - **Acceptance:**
    - Either: implement basic account view (order history lookup)
    - Or: display a clear "coming soon" state and remove the nav link until implemented
  - **Priority:** medium

---

### Low Priority / Polish

#### All Repos

- [x] **Coordinate D1 migration strategy across repos**
  - **Repo(s):** all
  - **Area:** Infra / DB
  - **Why:** Migrations exist in multiple repos targeting the same D1 database with no single canonical runner. This risks schema drift and accidental double-application.
  - **Acceptance:**
    - Document which repo owns migrations for which tables
    - Single migration runner script or CI job enforced
    - README updated with migration instructions
  - **Priority:** low

- [ ] **Add `CHANGELOG.md` to `api-middleware`**
  - **Repo(s):** api-middleware
  - **Area:** DX
  - **Why:** All three apps depend on this package via git ref. Without a changelog, consumers have no way to know what changed between versions without reading raw diffs.
  - **Acceptance:**
    - `CHANGELOG.md` created following Keep a Changelog format
    - Entries added for v0.1.0 and v0.1.1
    - Process documented: update CHANGELOG on every tag
  - **Priority:** low

- [ ] **Set up automated dependency updates (Dependabot or Renovate)**
  - **Repo(s):** all
  - **Area:** DX / Security
  - **Why:** No automated PR generation for dependency updates across any of the four repos. Outdated packages accumulate silently.
  - **Acceptance:**
    - Dependabot or Renovate configured on all four repos
    - Weekly update PRs generated for npm dependencies
    - `wrangler`, `next`, `stripe`, `zod`, and `@cloudflare/*` packages covered
  - **Priority:** low

#### Admin

- [ ] **Add adversarial prompt injection test suite for AI Assist**
  - **Repo(s):** olive_and_ivory_api, admin_olive_and_ivory_gifts
  - **Area:** AI Assist / Security
  - **Why:** Collection names and descriptions entered by admins are interpolated into OpenAI prompts. Malformed input could manipulate the AI output or attempt jailbreaks.
  - **Acceptance:**
    - Test cases covering: oversized input, HTML/script injection, jailbreak patterns in collection name
    - API returns 422 (not a 200 with corrupted output) for each case
    - Prompts use delimiters to clearly separate instructions from user data
  - **Priority:** low
  - **Notes:** See SECURITY.md — "OpenAI Prompt Injection"

#### API Worker

- [ ] **Define and enforce API versioning strategy**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** DX / Infra
  - **Why:** Routes exist at both `/collections` and `/api/collections` (duplicated for compatibility). There is no versioning strategy (e.g. `/v1/`), making future breaking changes hard to manage cleanly.
  - **Acceptance:**
    - Decision documented: chosen versioning strategy (e.g. `/v1/` prefix)
    - Non-versioned aliases marked deprecated with sunset date
    - ARCHITECTURE.md updated
  - **Priority:** low

- [ ] **Review event log PII retention against Australian Privacy Act**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Security / Legal
  - **Why:** `event_logs` stores customer IP addresses, emails, and order data for 30 days. The Australian Privacy Act 1988 (APPs) requires disclosure of what PII is collected and how long it is retained.
  - **Acceptance:**
    - Audit of what PII fields are stored in `event_logs` and `audit_logs`
    - Retention periods justified in a privacy note or policy
    - IP addresses pseudonymised (hashed) if full IP not required for debugging
    - Privacy policy page on storefront referencing log retention
  - **Priority:** low

- [ ] **Remove legacy `address_*` columns from the `orders` table**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Infra / DB
  - **Why:** `orders` table has duplicate address columns (`delivery_address_line1` / `address_line1`, etc.) written identically on every order creation — schema drift from a legacy rename. Dead columns waste storage and confuse readers.
  - **Acceptance:**
    - Full audit of all code reading `address_*` columns confirms no active consumer
    - D1 migration removes `address_line1`, `address_suburb`, `address_state`, `address_postcode`, `address_country`
    - Migration tested on staging first
  - **Priority:** low
  - **Notes:** REVIEW-001-011 — Day 001 review

- [ ] **Remove legacy pricing columns from `order_items` table**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Infra / DB
  - **Why:** `order_items` has duplicate `unit_price`/`unit_price_cents` and `line_total`/`line_total_cents` — bare names are legacy duplicates written identically to the `_cents` canonical columns.
  - **Acceptance:**
    - Audit confirms no consumer reads `unit_price` or `line_total` bare columns
    - D1 migration removes the legacy bare columns
    - Migration tested on staging first
  - **Priority:** low
  - **Notes:** REVIEW-001-012 — Day 001 review

- [x] **Define and enforce a data retention policy for `orders` and audit log tables**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Security / Legal
  - **Why:** `orders` and audit log tables grow indefinitely with no retention policy. Full customer PII (name, email, phone, delivery address) is stored in both tables. Australian Privacy Act requires a defined retention and deletion policy.
  - **Acceptance:**
    - Policy documented in `docs/SECURITY.md`
    - D1 scheduled cleanup job or manual procedure documented for both tables
    - Retention period justified (e.g. 7 years for tax compliance, 90 days for operational audit logs)
  - **Priority:** low
  - **Notes:** REVIEW-001-017 — Day 001 review

- [ ] **Add D1 migration guardrails and rollback notes**
  - **Repo(s):** olive_and_ivory_api, admin_olive_and_ivory_gifts
  - **Area:** Infra / DB
  - **Why:** As AI Assist schema evolves (new columns in `ai_prompts`, `gift_ai_runs`, etc.), there is no documented rollback procedure if a migration goes wrong in production.
  - **Acceptance:**
    - Each future migration file includes a `-- rollback:` comment with the inverse SQL
    - `docs/MAINTENANCE_CHECKLIST.md` updated with migration rollback procedure
    - At least one rehearsed rollback against the staging D1 instance
  - **Priority:** low

#### Storefront

- [ ] **Enable Next.js image optimisation via Cloudflare Images**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** SEO / Perf
  - **Why:** Image optimisation is disabled (`unoptimized: true`) because `sharp` is unavailable in Cloudflare Workers. Product images are served at full size, increasing page weight.
  - **Acceptance:**
    - Investigate Cloudflare Images or a transform Worker for on-demand resize
    - If viable, `unoptimized` flag removed and Next.js image component configured
    - Core Web Vitals LCP measured before and after
  - **Priority:** low

- [ ] **Implement Google Places session token refresh**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** Infra / Cost
  - **Why:** Client-side session tokens are generated once and never refreshed. Stale tokens reduce Places API caching effectiveness and may cause billing issues.
  - **Acceptance:**
    - Session token regenerated after each Places session completes (address selected or timed out after 3 min per Google's docs)
    - Token lifecycle documented in code
  - **Priority:** low

---

> Completed tasks: see [TASKS_DONE.md](TASKS_DONE.md)

## High Priority

- [x] **[SECURITY-CRITICAL] Cryptographically validate admin session cookie for API routes**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Auth / Security
  - **Why:** Next.js middleware only checks physical presence of oi_admin_session cookie, allowing full authentication bypass by injecting a spoofed cookie.
  - **Acceptance:**
    - Admin API endpoints reliably reject requests without a valid, verifiable cryptographically sound session hash stored in D1.
    - Middleware or high-order wrapper logic covers all admin_olive_and_ivory_gifts/src/app/api mutations.
  - **Priority:** high
  - **Notes:** REVIEW-008-001
  - **Status:** COMPLETE (2026-03-07) — Created `withSession.ts` wrapper that validates `oi_admin_session` cookie via D1 lookup, returns 401 if invalid


### Admin

- [x] **Sanitize prefix and collection_id to prevent R2 path traversal**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Security / Validation
  - **Why:** R2 Storage Key generation uses unsanitized strings for prefix and collection_id in /api/uploads, enabling directory traversal overwrites.
  - **Acceptance:**
    - prefix and collection_id are regex sanitized to strip out slashes and dots before string interpolation.
  - **Priority:** high
  - **Notes:** REVIEW-008-002
  - **Status:** COMPLETE (2026-03-07) — Added regex sanitization `/[^a-z0-9_-]/gi` on both fields, max 64 chars

- [x] **Strict extension allowlist mapped to MIME types**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Security / Validation
  - **Why:** File extension is blindly ripped from file.name and appended to R2 key. Attackers can upload files like .svg or .html disguised as image/jpeg.
  - **Acceptance:**
    - The file extension generated for the R2 key is mapped from an immutable, server-side MIME type or verified against an explicit whitelist.
  - **Priority:** high
  - **Notes:** REVIEW-008-003
  - **Status:** COMPLETE (2026-03-07) — Created MIME_TO_EXT server-side map, derive extension from validated MIME type (not client filename)

## Medium Priority

- [x] **Remove PRAGMA introspection from /api/uploads**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Performance
  - **Why:** Dynamically discovers schema of D1 collections table using PRAGMA before writing, adding an unnecessary synchronous database roundtrip.
  - **Acceptance:**
    - Direct static UPDATE statement is used without schema capability querying.
  - **Priority:** medium
  - **Notes:** REVIEW-008-004

- [x] **Implement async compensation rollback for R2 uploads on D1 failure**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Reliability
  - **Why:** If D1 update fails, it is silently ignored, leaving an orphaned object in the R2 bucket and increasing storage costs.
  - **Acceptance:**
    - In the D1 catch hook, the system initiates a compensating transaction env.BUCKET.delete(key).
  - **Priority:** medium
  - **Notes:** REVIEW-008-005

- [x] **[SECURITY-CRITICAL] Cryptographically validate admin session cookie for API routes (Generate Image)**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Auth / Security
  - **Why:** `POST /api/ai/items/generate-image` relies only on the middleware presence check for `oi_admin_session`, allowing unauthenticated malicious users to spoof a cookie and rapidly drain the system's OpenAI credits/bucket quota.
  - **Acceptance:**
    - Wrap the export in `withSession` to validate the db-backed cryptographic token.
  - **Priority:** high
  - **Notes:** REVIEW-009-001

- [x] **Sanitize `payload.product.id` to prevent R2 path traversal**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Security / Validation
  - **Why:** `product.id` defines the object's folder structure in R2. Path traversal strings (e.g. `../../../`) injected here grant ability to overwrite files outside of the target sandbox.
  - **Acceptance:**
    - Force stripping of any special pathing characters `[^a-z0-9_-]` from `product.id`.
  - **Priority:** high
  - **Notes:** REVIEW-009-002

- [x] **Mitigate Prompt Injection on OpenAI image generation**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Security / AI Assist
  - **Why:** Product name, notes, and tags are directly concatenated into OpenAI prompt instructions. A hostile input could bypass system constraints and alter output significantly.
  - **Acceptance:**
    - Explicitly enclose any unsanitized user inputs within protective XML tags, instructing the model exactly how to consume them.
  - **Priority:** medium
  - **Notes:** REVIEW-009-003

- [x] **Remove PRAGMA introspection in generate-image route**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Performance
  - **Why:** Dynamic checking if `inventory_items` includes specific columns wastes round trips.
  - **Acceptance:**
    - Drop `PRAGMA table_info` query and use a statically defined schema expectation for the D1 update.
  - **Priority:** low
  - **Notes:** REVIEW-009-004

- [x] **Parallelise R2 operations and handle partial failures (generate-image)**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Reliability / Performance
  - **Why:** R2 put calls for large, medium, thumb happen linearly, increasing response latency. Partial failure on `updateItemImage` creates permanent bucket orphans.
  - **Acceptance:**
    - Wrap uploads in `Promise.all` and ensure compensating deletions if D1 write fails.
  - **Priority:** low
  - **Notes:** REVIEW-009-005

- [ ] **Stock reservation race condition — silent UPDATE failure allows overselling**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Data Integrity
  - **Why:** `reserveOrderInventoryStock` UPDATE has `WHERE stock_on_hand >= ?` but if it affects 0 rows (concurrent reservation), no error is raised. Order proceeds without stock decremented.
  - **Acceptance:**
    - Check `meta.changes` on stock UPDATE results; roll back order if 0
  - **Priority:** high
  - **Notes:** REVIEW-010-001

- [ ] **Restore query resolves gifts differently from reservation**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Data Integrity
  - **Why:** Reserve uses `gift_id` directly from cart. Restore uses complex COALESCE with collection_id fallback. Mismatch can restore wrong inventory items.
  - **Acceptance:**
    - Align restore gift resolution with reserve logic, or store reserved inventory_ids on the order for exact restore
  - **Priority:** medium
  - **Notes:** REVIEW-010-002

- [ ] **HMAC signing path inconsistency — storefront signs without query string**
  - **Repo(s):** olive_and_ivory_gifts, api-middleware
  - **Area:** Security
  - **Why:** Storefront signs `path` only (no query string). Server has legacy fallback that retries without query string. If fallback is removed, all GET requests with params will break.
  - **Acceptance:**
    - Align signing to include query string, or document the fallback as permanent
  - **Priority:** low
  - **Notes:** REVIEW-010-003
