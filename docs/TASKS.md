# Outstanding Tasks & Improvements

> Last updated: 2026-03-05
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

### High Priority

#### API Worker

- [ ] **Add request timeout handling on all outbound fetch calls**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Infra
  - **Why:** No `AbortController` timeout on calls to Stripe, OpenAI, Google Places, or Brevo. A slow upstream hangs the Worker isolate until Cloudflare's hard limit.
  - **Acceptance:**
    - All outbound `fetch()` calls wrapped with `AbortController` and a configurable timeout (default 10s)
    - Timeout errors classified and returned as 504 with structured error body
  - **Priority:** high

- [ ] **Add idempotency handling to order creation**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** Infra
  - **Why:** Needs redesign — `orderId = crypto.randomUUID()` is generated per-request, so Worker retries create new UUIDs rather than colliding. The duplicate-INSERT scenario described requires a client-supplied idempotency key. Proposed: add `idempotency_key` field to checkout request, add `UNIQUE` constraint to D1, implement upsert + return-existing-order logic.
  - **Acceptance:**
    - Caller supplies an `idempotency_key` in the request body (e.g. cart session ID)
    - `orders` table has `UNIQUE(idempotency_key)` constraint
    - Duplicate key within TTL window returns the existing order + Stripe session (or re-creates an expired session)
  - **Priority:** high
  - **Notes:** REVIEW-001-009 — Day 001 review; deferred pending design

#### Admin


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

- [ ] **Implement `/contact` page form submission**
  - **Repo(s):** olive_and_ivory_gifts
  - **Area:** CX
  - **Why:** The contact page renders a form but has no submission handler. Customers expecting to send an enquiry get no feedback and no message is delivered.
  - **Acceptance:**
    - Form submits to an API route (Brevo, email webhook, or similar)
    - Success and error states shown to user
    - Rate limited at middleware level
  - **Priority:** high

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

---

### Medium Priority

#### Storefront

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

- [ ] **Pin schema version per AI run in `gift_ai_runs` table**
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

- [ ] **Split `coreRoutes.ts` into domain-scoped route files**
  - **Repo(s):** olive_and_ivory_api
  - **Area:** DX
  - **Why:** At 4,372 lines, `coreRoutes.ts` is a single-file monolith. It is slow to navigate, hard to review in PRs, and increases merge conflict surface area.
  - **Acceptance:**
    - Routes split into at minimum: `collections.ts`, `gifts.ts`, `orders.ts`, `media.ts`, `inventory.ts`, `delivery.ts`, `ai.ts`, `admin.ts`
    - Shared helpers extracted to `src/lib/responseHelpers.ts`, `src/lib/logging.ts`, `src/lib/schemaCache.ts`
    - `index.ts` registers each module; TypeScript compiles cleanly; all routes verified in production
  - **Priority:** medium
  - **Notes:** REVIEW-001-015 — full split plan in `docs/reviews/2026-03-01-day001-POST-api-orders.md#F`

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

- [ ] **Refactor Media panel to compact row layout**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Images / UX
  - **Why:** Large static 4:5 preview card wastes ~350px of vertical space even when no editing is happening; duplicates the hero preview already shown in the right-side panel
  - **Acceptance:**
    - Large static preview card removed from GiftMediaEditor
    - Compact row list with small thumbnails (max 80px height) replaces it
    - Inline expanded edit row appears on item activation with alt text, focal, crop controls
    - Add image button always visible; keyboard accessible expand/collapse
  - **Priority:** medium

- [ ] **Split GiftEditorForm into focused feature sections**
  - **Repo(s):** admin_olive_and_ivory_gifts
  - **Area:** Editor UX / Maintainability
  - **Why:** `GiftEditorForm.tsx` remains a large multi-responsibility file even after extracting gift product management. This slows changes and increases regression risk.
  - **Acceptance:**
    - `GiftEditorForm.tsx` reduced below 500 LOC
    - Core sections (overview, AI, media, products, SEO/tags, preview) moved into focused child components or hooks
    - Existing behavior and save contract unchanged
  - **Priority:** medium
  - **Notes:** Product assignment moved into `src/components/gift-editor/GiftProductsSection.tsx`, but the parent form is still oversized.

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

- [ ] **Coordinate D1 migration strategy across repos**
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
