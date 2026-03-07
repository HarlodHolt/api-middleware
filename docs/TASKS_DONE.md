# Completed Tasks

> Companion to [TASKS.md](TASKS.md)
> Last updated: 2026-03-08

---

### Reviews Program

- [x] **Complete Day 005 deep-dive review: `createStripeCheckoutSession()`** — docs · REVIEW-005 · 2026-03-05
- [x] **Complete Day 006 deep-dive review: Log Explorer observability and API usage coverage** — docs · REVIEW-006 · 2026-03-05
- [x] **Forward client provenance headers (`cf-connecting-ip`, `x-forwarded-for`, `user-agent`) through signed admin/storefront → API worker calls** — admin_olive_and_ivory_gifts, olive_and_ivory_gifts · REVIEW-006-001 (partial remediation) · 2026-03-05
- [x] **Complete Day 008 deep-dive review: `POST /api/uploads`** — docs · REVIEW-008 · 2026-03-08

### Admin — Auth Security (Day 003 Review Fixes)

- [x] **Add rate limiting to admin login endpoint (P0)** — admin_olive_and_ivory_gifts · REVIEW-003-001 · 2026-03-03
- [x] **Guard `request.json()` and null `password_hash` in login handler** — admin_olive_and_ivory_gifts · REVIEW-003-002/005 · 2026-03-03
- [x] **Add input length limits on email and password** — admin_olive_and_ivory_gifts · REVIEW-003-003 · 2026-03-03
- [x] **Constant-time comparison in `verifyPassword`** — admin_olive_and_ivory_gifts · REVIEW-003-004 · 2026-03-03
- [x] **`createSession` throws on DB execute failure** — admin_olive_and_ivory_gifts · REVIEW-003-006 · 2026-03-03
- [x] **Replace `SELECT *` with explicit columns in user lookup; normalise email case** — admin_olive_and_ivory_gifts · REVIEW-003-007/008 · 2026-03-03
- [x] **Add audit log to logout route** — admin_olive_and_ivory_gifts · REVIEW-003-009 · 2026-03-05
- [x] **Remove debug fields from `/api/auth/me` production response** — admin_olive_and_ivory_gifts · REVIEW-003-010 · 2026-03-05
- [x] **Remove unused `sessions.csrf_token` flow (migration + session create fallback)** — admin_olive_and_ivory_gifts · REVIEW-003-011 · 2026-03-05

### Storefront — Browse Performance & Observability

- [x] **Cache `tableExists` results in `browse.ts`** — olive_and_ivory_gifts · 2026-03-03
- [x] **Remove `console.info` production log noise from `browse.ts`** — olive_and_ivory_gifts · 2026-03-03

### Storefront — Browse Page UX

- [x] **Auto-apply filters + Settle Timer (1s)** — olive_and_ivory_gifts
- [x] **Async Route Updates + Non-blocking grids** — olive_and_ivory_gifts
- [x] **Collapsible sidebar + Compact Summary** — olive_and_ivory_gifts
- [x] **Selected Filters strip + Clear all** — olive_and_ivory_gifts
- [x] **UI Polish (Grid density, hover card)** — olive_and_ivory_gifts
- [x] **Collapsible sidebar padding fix** — olive_and_ivory_gifts
- [x] **Add Products & Collections facet filtering** — olive_and_ivory_gifts, olive_and_ivory_api

### API Worker

- [x] **Complete `collection_items` → `gift_inventory_items` migration cutover** — olive_and_ivory_api
- [x] **Verify HMAC nonce uniqueness enforcement** — olive_and_ivory_api, api-middleware
- [x] **Log warning when Stripe event orderId cannot be resolved** — olive_and_ivory_api · REVIEW-002-003
- [x] **Add explicit event type allowlist to Stripe webhook handler** — olive_and_ivory_api · REVIEW-002-004
- [x] **Exempt Stripe webhook from global rate limit** — olive_and_ivory_api, api-middleware · REVIEW-002-005
- [x] **Implement or remove `/shipping/details` endpoint** — olive_and_ivory_api
- [x] **Register POST method on `/api/orders` in route registry** — olive_and_ivory_api · REVIEW-001-001, commit `00ffdfb`
- [x] **Validate `success_url`/`cancel_url` before passing to Stripe** — olive_and_ivory_api · REVIEW-001-002, commit `00ffdfb`
- [x] **Add email format validation to order creation** — olive_and_ivory_api · REVIEW-001-003, commit `00ffdfb`
- [x] **Add max-length enforcement for all order string fields** — olive_and_ivory_api · REVIEW-001-004, commit `00ffdfb`
- [x] **Wrap order_items batch INSERT in try/catch with compensating rollback** — olive_and_ivory_api · REVIEW-001-005, commit `00ffdfb`
- [x] **Log Stripe checkout session creation failures** — olive_and_ivory_api · REVIEW-001-006, commit `00ffdfb`
- [x] **Add active/visible filter to collection SELECT in order creation** — olive_and_ivory_api · REVIEW-001-007, commit `4871213`
- [x] **Replace per-request `tableExists`/`getTableColumns` with a module-level schema cache** — olive_and_ivory_api · REVIEW-001-008, commit `4871213`
- [x] **Redact PII fields from audit log order payloads** — olive_and_ivory_api · REVIEW-001-010, commit `4871213`
- [x] **Enforce max `delivery_date` (12 weeks in advance)** — olive_and_ivory_api · REVIEW-001-013, commit `4871213`
- [x] **Fix Sunday delivery block to use AEST timezone, not UTC** — olive_and_ivory_api · REVIEW-001-014, commit `4871213`
- [x] **Enforce a minimum total for orders (reject $0 orders)** — olive_and_ivory_api · REVIEW-001-016, commit `4871213`
- [x] **Split `index.ts` into focused modules** — olive_and_ivory_api · 2026-03-02
- [x] **Default-deny undocumented API worker routes and register the refund endpoint** — olive_and_ivory_api · REVIEW-004-001 · 2026-03-03
- [x] **Make Stripe refunds idempotent and replay-safe with an `order_refunds` ledger** — olive_and_ivory_api · REVIEW-004-002/003 · 2026-03-03
- [x] **Log rejected and upstream-failed refund attempts** — olive_and_ivory_api · REVIEW-004-004 · 2026-03-03
- [x] **Require server-owned redirect allowlist for Stripe checkout URLs** — olive_and_ivory_api · REVIEW-005-001 · 2026-03-05
- [x] **Preserve Stripe error object details in checkout session failures** — olive_and_ivory_api · REVIEW-005-002 · 2026-03-05
- [x] **Define retention policy and manual cleanup procedure for `orders`/`audit_logs`/`event_logs`** — docs · REVIEW-001-017 · 2026-03-05

### Admin

- [x] **Remove deprecated `/api/admin/collections/[id]/ai-assist` route alias** — admin_olive_and_ivory_gifts, olive_and_ivory_api
- [x] **Fix admin app page metadata (title / description)** — admin_olive_and_ivory_gifts
- [x] **Implement UI partial apply / field-level accept for AI suggestions** — admin_olive_and_ivory_gifts
- [x] **Clean up `_page_backup.tsx`** — admin_olive_and_ivory_gifts
- [x] **Remove dead `GiftItemRow` type from `types.ts`** — admin_olive_and_ivory_gifts

### Storefront

- [x] **Remove geocode debug logging from production** — olive_and_ivory_gifts · `src/app/api/geocode/route.ts`
- [x] **Remove `BRAND_DEBUG` flag from `Header.tsx`** — olive_and_ivory_gifts

### Admin — Day 008 Review Fixes (2026-03-08)

- [x] **[SECURITY-CRITICAL] Cryptographically validate admin session cookie for API routes** — admin_olive_and_ivory_gifts · REVIEW-008-001 · 2026-03-08
  - Created `withSession.ts` wrapper; validates `oi_admin_session` via D1 lookup; returns 401 if missing or invalid
- [x] **Sanitize `prefix` and `collection_id` to prevent R2 path traversal** — admin_olive_and_ivory_gifts · REVIEW-008-002 · 2026-03-08
  - Regex `/[^a-z0-9_-]/gi` applied to both fields; max 64 chars enforced
- [x] **Strict extension allowlist mapped to MIME types** — admin_olive_and_ivory_gifts · REVIEW-008-003 · 2026-03-08
  - Created `MIME_TO_EXT` server-side map; extension derived from validated MIME type, not client filename

### Admin — Day 009 Review Fixes (2026-03-09)

- [x] **[SECURITY-CRITICAL] Cryptographically validate admin session cookie for Generate Image** — admin_olive_and_ivory_gifts · REVIEW-009-001 · 2026-03-09
  - Wrapped `POSTHandler` export in `withSession` to validate cryptographic session block via D1
- [x] **Sanitize `payload.product.id` to prevent R2 path traversal** — admin_olive_and_ivory_gifts · REVIEW-009-002 · 2026-03-09
  - Sanitised user-controlled ID with strict alphanumeric regex before R2 key construction
- [x] **Remove PRAGMA introspection from `generate-image` route** — admin_olive_and_ivory_gifts · REVIEW-009-004 · 2026-03-09
  - Replaced double-roundtrip D1 table checks with static `UPDATE inventory_items`

### Admin + API — Inventory Canonical Schema Refactor (2026-03-07/08)

- [x] **Align `Item` interface to canonical `inventory_items` column names** — admin_olive_and_ivory_gifts · 2026-03-07
  - Renamed: `sku`→`slug`, `barcode`→`barcode_gtin`, `image_key`→`hero_image_key`, `stock_quantity`→`stock_on_hand`, `pack_qty`→`qty_per_pack`, `price_cents`→`price_per_pack_cents`, `cost_cents`→`cost_per_pack_cents`
- [x] **Update `InventoryTable`, `GiftProductsSection`, `useInventoryBulkAiHelpers` to canonical fields** — admin_olive_and_ivory_gifts · 2026-03-07
- [x] **Update `fromItem()` DB→FormState mapping to canonical field names** — admin_olive_and_ivory_gifts · 2026-03-07
- [x] **`mapInventoryRowToLegacyItem` returns canonical `Item` shape** — admin_olive_and_ivory_gifts · 2026-03-07
- [x] **`ItemActivationCandidate` and `activate/route.ts` use canonical fields** — admin_olive_and_ivory_gifts · 2026-03-07
- [x] **`inventorySuggestionSchema` renamed to canonical field names** (`sku`→`slug`, `barcode`→`barcode_gtin`, `store_name`→`store`, `pack_qty`→`qty_per_pack`, `description`→`notes`) — admin_olive_and_ivory_gifts · 2026-03-08
- [x] **`bulk-import` sample data and `inventoryJsonBulkHelpers` sample corrected** — admin_olive_and_ivory_gifts · 2026-03-07
- [x] **`INVENTORY_BULK_EDIT_FIELDS` consolidated** (`description`+`notes` → single `notes`) — admin_olive_and_ivory_gifts · 2026-03-08
- [x] **`INVENTORY_COLUMN_BY_FIELD` duplicate alias removed** (`description`→`notes` dropped, `notes`→`notes` kept) — admin_olive_and_ivory_gifts · 2026-03-08
- [x] **`InventoryEditor` AI `buildRequestBody` sends canonical field names** — admin_olive_and_ivory_gifts · 2026-03-08
- [x] **`buildPayload` in `useInventorySubmit` sends `notes` not `description`; drops computed `unit_price`** — admin_olive_and_ivory_gifts · 2026-03-08
- [x] **`InventoryRecordInput` alias fields documented with JSDoc** — admin_olive_and_ivory_gifts · 2026-03-08
- [x] **`inventory_audit.md` and `refactor-todo.md` updated with completion status** — docs · 2026-03-08
- [x] **TypeScript build confirmed zero errors throughout entire refactor** — admin_olive_and_ivory_gifts · 2026-03-08

### API Worker — `giftItemDb.ts` canonical schema support (2026-03-08)

- [x] **`giftItemDb` stock query supports both `stock_on_hand` and `stock_quantity` columns** — olive_and_ivory_api · 2026-03-08
  - Detects `stock_on_hand` / `stock_quantity` columns; falls back gracefully; exposes both as aliases in SELECT
- [x] **`giftItemDb` `qty_per_pack` / `pack_qty` dual-column support** — olive_and_ivory_api · 2026-03-08
- [x] **`giftItemDb` `low_stock_threshold` column detected dynamically instead of hardcoded `5`** — olive_and_ivory_api · 2026-03-08
- [x] **`giftCrudRoutes` stock normalization uses `stock_on_hand ?? stock_quantity` and `qty_per_pack ?? pack_qty`** — olive_and_ivory_api · 2026-03-08

### API Worker — `collectionGiftDb.ts` one-collection-per-gift enforcement (2026-03-08)

- [x] **`upsertCollectionGiftLinks` clears prior assignment for gift before inserting new link** — olive_and_ivory_api · 2026-03-08
- [x] **`upsertCollectionGiftLinks` back-fills `gifts.collection_id` after linking** — olive_and_ivory_api · 2026-03-08
- [x] **Gift list query uses `ranked_links` CTE for deduped collection assignment** — olive_and_ivory_api · 2026-03-08
- [x] **`collectionGiftDb` fetch uses `linked + fallback` CTE to merge `collection_gifts` table and `gifts.collection_id` legacy field** — olive_and_ivory_api · 2026-03-08
- [x] **Gift update route syncs `collection_gifts` table when `collection_id` changes** — olive_and_ivory_api · 2026-03-08
