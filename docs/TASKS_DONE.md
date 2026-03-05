# Completed Tasks

> Companion to [TASKS.md](TASKS.md)
> Last updated: 2026-03-05

---

### Reviews Program

- [x] **Complete Day 005 deep-dive review: `createStripeCheckoutSession()`** — docs · REVIEW-005 · 2026-03-05
- [x] **Complete Day 006 deep-dive review: Log Explorer observability and API usage coverage** — docs · REVIEW-006 · 2026-03-05
- [x] **Forward client provenance headers (`cf-connecting-ip`, `x-forwarded-for`, `user-agent`) through signed admin/storefront -> API worker calls** — admin_olive_and_ivory_gifts, olive_and_ivory_gifts · REVIEW-006-001 (partial remediation) · 2026-03-05

### Admin — Auth Security (Day 003 Review Fixes)

- [x] **Add rate limiting to admin login endpoint (P0)** — admin_olive_and_ivory_gifts · REVIEW-003-001 · 2026-03-03
- [x] **Guard `request.json()` and null `password_hash` in login handler** — admin_olive_and_ivory_gifts · REVIEW-003-002/005 · 2026-03-03
- [x] **Add input length limits on email and password** — admin_olive_and_ivory_gifts · REVIEW-003-003 · 2026-03-03
- [x] **Constant-time comparison in `verifyPassword`** — admin_olive_and_ivory_gifts · REVIEW-003-004 · 2026-03-03
- [x] **`createSession` throws on DB execute failure** — admin_olive_and_ivory_gifts · REVIEW-003-006 · 2026-03-03
- [x] **Replace `SELECT *` with explicit columns in user lookup; normalise email case** — admin_olive_and_ivory_gifts · REVIEW-003-007/008 · 2026-03-03

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

### Admin

- [x] **Remove deprecated `/api/admin/collections/[id]/ai-assist` route alias** — admin_olive_and_ivory_gifts, olive_and_ivory_api
- [x] **Fix admin app page metadata (title / description)** — admin_olive_and_ivory_gifts
- [x] **Implement UI partial apply / field-level accept for AI suggestions** — admin_olive_and_ivory_gifts
- [x] **Clean up `_page_backup.tsx`** — admin_olive_and_ivory_gifts
- [x] **Remove dead `GiftItemRow` type from `types.ts`** — admin_olive_and_ivory_gifts

### Storefront

- [x] **Remove geocode debug logging from production** — olive_and_ivory_gifts · `src/app/api/geocode/route.ts`
- [x] **Remove `BRAND_DEBUG` flag from `Header.tsx`** — olive_and_ivory_gifts
