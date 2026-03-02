# Completed Tasks

> Companion to [TASKS.md](TASKS.md)
> Last updated: 2026-03-02

---

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

### Admin

- [x] **Remove deprecated `/api/admin/collections/[id]/ai-assist` route alias** — admin_olive_and_ivory_gifts, olive_and_ivory_api
- [x] **Fix admin app page metadata (title / description)** — admin_olive_and_ivory_gifts
- [x] **Implement UI partial apply / field-level accept for AI suggestions** — admin_olive_and_ivory_gifts
- [x] **Clean up `_page_backup.tsx`** — admin_olive_and_ivory_gifts
- [x] **Remove dead `GiftItemRow` type from `types.ts`** — admin_olive_and_ivory_gifts

### Storefront

- [x] **Remove geocode debug logging from production** — olive_and_ivory_gifts · `src/app/api/geocode/route.ts`
- [x] **Remove `BRAND_DEBUG` flag from `Header.tsx`** — olive_and_ivory_gifts
