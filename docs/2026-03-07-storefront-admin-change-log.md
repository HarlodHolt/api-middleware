# Change Log - 2026-03-07

## Scope
Storefront + Admin updates for collections/gifts visibility, homepage trending source control, and hero carousel data.

## Deployed Preview URLs
- Storefront preview: https://955e9123.olive-and-ivory-gifts.pages.dev
- Admin preview: https://e4b28a25.admin-olive-and-ivory-gifts.pages.dev

## Production-DB Changes Applied
Database: `olive-and-ivory-gifts-db` (remote D1)

1) Setting changed:
- `settings.HOMEPAGE_TRENDING_SOURCE = 'all_active'`
- Updated at: `2026-03-07 08:24:44`

2) Hero slides inserted (3 rows):
- id `34cfe1a7581480e3662d594d71881dd4` - "The Canberra-Curated Gift Studio."
- id `00761437f04f6e1308672c6cd5441ac7` - "Moments Worth Toasting."
- id `5fbc4c1ffeee3fdbd5876178ed8e6200` - "A Little Piece of Calm."
- created_at: `2026-03-07 08:25:50`

## Code Changes (Storefront Repo)
Repo: `/Users/yuri_baker/dev/olive_and_ivory_gifts`

- `src/lib/data/variants.ts`
  - Unified gift sourcing to include both:
    - `collection_gifts` assignments
    - direct `gifts.collection_id`
  - Added dedupe over `(gift_id, collection_id)`.
  - Added `getAllCollectionsWithGifts()`.

- `src/app/page.tsx`
  - Added setting-based trending source switch:
    - `featured` (current curated behavior)
    - `all_active` (all active collections with gifts)

- `src/lib/data/dbHelpers.ts`
  - Added `getHomepageTrendingSource()` and `HomepageTrendingSource` type.

- `src/lib/data.ts`
  - Re-export path is updated to modular data files.

## Code Changes (Admin Repo)
Repo: `/Users/yuri_baker/dev/admin_olive_and_ivory_gifts`

- `src/app/(dashboard)/settings/page.tsx`
  - Added "Homepage Carousel" settings card.
  - Added setting selector for `HOMEPAGE_TRENDING_SOURCE`.

- `src/app/api/settings/route.ts`
  - Added `HOMEPAGE_TRENDING_SOURCE` to allowed settings keys.

## Rollback Commands

### A) Revert homepage trending source to curated (featured)
```bash
npx wrangler d1 execute olive-and-ivory-gifts-db --remote --command "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('HOMEPAGE_TRENDING_SOURCE','featured',datetime('now'));"
```

### B) Remove the 3 inserted hero slides
```bash
npx wrangler d1 execute olive-and-ivory-gifts-db --remote --command "DELETE FROM hero_slides WHERE id IN ('34cfe1a7581480e3662d594d71881dd4','00761437f04f6e1308672c6cd5441ac7','5fbc4c1ffeee3fdbd5876178ed8e6200');"
```

### C) Full code rollback
- Revert git changes in both repos back to the previous known commit before these edits.
- Redeploy both projects after reset.

## Continue Plan (for R2 re-key)
1. Dry-run: build key map old->new opaque keys.
2. Copy objects in R2 only (no deletes).
3. Update all DB references transactionally.
4. Validate all referenced keys exist and pages render.
5. Delete old keys only after validation.

## R2 Rekey Operation (Executed)
Timestamp: 2026-03-07 08:51 UTC

### What was executed
- Dry-run generated mapping for existing image references.
- Objects copied in R2 from old keys to opaque keys (no deletes):
  - mapped keys: 16
  - copied objects: 16 (subsequent rerun skipped copies)
- D1 references updated to new opaque keys across:
  - `collections.hero_image_key`
  - `gifts.hero_image_key`
  - `gifts.og_image_key`
  - `gift_media.image_key`
  - `hero_slides.image_key`
  - `inventory_items.hero_image_key`
- Verification:
  - old refs remaining in DB: 0
  - homepage/collections now render `.../v2/...` keys only

### Artifacts
- Dry run JSON: `/Users/yuri_baker/dev/docs/r2-rekey-dry-run-2026-03-07T08-44-27-360Z.json`
- Before snapshot: `/Users/yuri_baker/dev/docs/r2-rekey-before-snapshot-2026-03-07T08-51-15-704Z.json`
- Applied map: `/Users/yuri_baker/dev/docs/r2-rekey-applied-map-2026-03-07T08-51-15-704Z.json`
- Rollback SQL: `/Users/yuri_baker/dev/docs/r2-rekey-rollback-2026-03-07T08-51-15-704Z.sql`

### Rollback command
```bash
npx wrangler d1 execute olive-and-ivory-gifts-db --remote --file /Users/yuri_baker/dev/docs/r2-rekey-rollback-2026-03-07T08-51-15-704Z.sql
```

Note: Old R2 objects were intentionally retained, so rollback is DB-only and immediate.
