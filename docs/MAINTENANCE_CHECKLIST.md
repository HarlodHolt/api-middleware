# Maintenance Checklist

> Last updated: 2026-03-05
> Owner: repo agent / Yuri
> Scope: Recurring dev and deploy checklists

Use this when actively developing across the repos. Tick off items before pushing to production or after a significant batch of changes.

Local command reference: [LOCAL_TESTING.md](./LOCAL_TESTING.md)

---

## Before Starting a Prompt Session

- [ ] Check which repo you are in (`pwd` / look at the branch and remote)
- [ ] Pull latest on all 4 repos to avoid working on stale code
  ```bash
  git -C ~/dev pull
  git -C ~/dev/olive_and_ivory_gifts pull
  git -C ~/dev/admin_olive_and_ivory_gifts pull
  git -C ~/dev/olive_and_ivory_api pull
  ```
- [ ] Check for any outstanding TODOs in [TASKS.md](./TASKS.md) that may affect the work
- [ ] If modifying `api-middleware`, note which consumer repos will need their git ref updated

---

## After Changing `api-middleware`

- [ ] Bump the version in `package.json` (follow semver: patch for fixes, minor for new features, major for breaking changes)
- [ ] Tag the release in git: `git tag vX.Y.Z && git push origin vX.Y.Z`
- [ ] Update the git reference in `olive_and_ivory_gifts/package.json`
- [ ] Update the git reference in `admin_olive_and_ivory_gifts/package.json`
- [ ] Update the git reference in `olive_and_ivory_api/package.json`
- [ ] Run `npm install` in each consumer repo to pull the new version
- [ ] Test all three apps still build and type-check cleanly

---

## After Changing the API Worker (`olive_and_ivory_api`)

- [ ] Check that no public routes have accidentally been placed behind HMAC auth
- [ ] Check that no private routes have accidentally been made public
- [ ] Verify the CORS allowed origins still match production domains
- [ ] If database schema changed: write a D1 migration file, do not edit existing migrations
- [ ] If new env vars added: update `wrangler.toml` and document in `DEPENDENCIES.md`
- [ ] Run TypeScript check: `npx tsc --noEmit`
- [ ] Deploy to staging / preview before production: `wrangler deploy --env staging`

---

## After Changing the Storefront (`olive_and_ivory_gifts`)

- [ ] Verify the `/api/health` route still returns 200
- [ ] Check that HMAC signing is still applied on all proxy routes (search for `proxySigned` or `createHmacSignature`)
- [ ] If new API routes were added, ensure they have correct rate limiting in `middleware.ts`
- [ ] Test browse/filter, cart, and checkout flow end-to-end in preview
- [ ] Check Next.js build output: `npm run build`
- [ ] If new env vars added: update `wrangler.toml` and `DEPENDENCIES.md`

---

## After Changing the Admin Site (`admin_olive_and_ivory_gifts`)

- [ ] Verify login + session flow still works
- [ ] Check that new pages are protected by the auth middleware (not accidentally public)
- [ ] Run Playwright tests if available: `npx playwright test`
- [ ] Check Next.js build output: `npm run build`
- [ ] If new env vars added: update `wrangler.toml` and `DEPENDENCIES.md`

---

## Database Migrations

Do this whenever a D1 schema change is needed.

- [ ] Write a new migration file — never edit existing migration files
- [ ] Migration filenames should be sequential and descriptive, e.g. `0023_add_gift_tags.sql`
- [ ] Test migration against the local D1 instance first
- [ ] Apply to production D1: `wrangler d1 migrations apply <DB_NAME> --remote`
- [ ] Verify with: `wrangler d1 execute <DB_NAME> --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`
- [ ] Update schema documentation if the migration changes something significant

---

## Before Every Production Deploy

- [ ] No debug `console.log` statements left in hot paths
- [ ] No hardcoded secrets or API keys in source code
- [ ] No test/dev endpoints exposed (check for `/stripe/test-*`, `/log-test`, etc.)
- [ ] Confirm all new API routes have appropriate rate limiting
- [ ] Confirm HMAC auth is applied to all state-changing non-public routes
- [ ] TypeScript has no type errors: `npx tsc --noEmit`
- [ ] Run `npm audit` to check for known vulnerabilities in npm dependencies
  > Note: `api-middleware` git dependency is not scanned by npm audit — review manually
- [ ] Check Cloudflare dashboard for any Worker errors or D1 capacity warnings

---

## Weekly / Periodic Checks

- [ ] Review error logs in the admin `/logs` page — look for patterns of 4xx/5xx errors
- [ ] Check D1 storage usage (Cloudflare dashboard) — event_logs table can grow fast
- [ ] Confirm the `/internal/cron/observability` cron is running on schedule
- [ ] Review rate limit hits in logs — unexpected spikes may indicate abuse or bugs
- [ ] Check Stripe dashboard for failed webhooks or unresolved payment events
- [ ] Check OpenAI usage and billing — AI endpoints can incur unexpected costs
- [ ] Rotate `HMAC_SHARED_SECRET` if there's any suspicion it has been exposed
- [ ] Check Google Places API quotas in Google Cloud Console

### Quarterly Data Retention Runbook (REVIEW-001-017)

- [ ] Confirm current date/time and retention cutoff points:
  - `audit_logs`: 90 days
  - `event_logs`: 30 days
  - `orders`: 7 years (requires finance/legal hold confirmation)
- [ ] Backup D1 before destructive cleanup.
- [ ] Run retention SQL against production D1:
  ```sql
  DELETE FROM audit_logs
  WHERE datetime(created_at) < datetime('now', '-90 days');

  DELETE FROM event_logs
  WHERE datetime(created_at) < datetime('now', '-30 days');
  ```
- [ ] For `orders` older than 7 years, confirm legal/tax hold status before deletion:
  ```sql
  DELETE FROM orders
  WHERE datetime(created_at) < datetime('now', '-7 years');
  ```
- [ ] Record execution date and row counts removed in the deployment log.

---

## When Adding a New Feature Across Repos

- [ ] Decide: does this need a new API endpoint, or can the existing API handle it?
- [ ] If new endpoint: update `olive_and_ivory_api`, then update consumer repos
- [ ] If new D1 table/column: write migration, apply to all environments
- [ ] If new env var: document in `DEPENDENCIES.md`, add to all `wrangler.toml` files
- [ ] If new external service: add to the External Services table in `DEPENDENCIES.md`
- [ ] Consider if the feature needs rate limiting, logging, and HMAC auth
- [ ] Update `PROJECT_OVERVIEW.md` or `ARCHITECTURE.md` if the architecture changes

---

## Prompt Session Hygiene (Claude Code)

When doing many prompts in a row across this project:

- [ ] Tell Claude which repo you are working in at the start of each session
- [ ] Re-confirm the active repo when switching between `olive_and_ivory_gifts`, `admin_olive_and_ivory_gifts`, `olive_and_ivory_api`, and the root `api-middleware`
- [ ] Ask Claude to read the relevant file before editing it — never edit blind
- [ ] After a batch of changes, run a git diff to review everything before committing
- [ ] Commit in small, focused chunks — one feature or fix per commit
- [ ] Check these docs (`/dev/docs/`) at the start of sessions involving architecture changes
- [ ] If Claude modifies `api-middleware`, explicitly ask it to also update the consuming repos
- [ ] If Claude adds new endpoints to the API, ask it to check rate limiting and HMAC auth coverage

---

## Definition of Done (Docs)

Every PR or commit must satisfy the docs checklist below before it is considered complete.
The agent must update docs as part of the same commit — not as a follow-up.

- [ ] **TASKS.md** — Added or updated at least one item. Use `npx tsx scripts/docs_writer.ts add-task` or edit manually using the standard template.
- [ ] **ARCHITECTURE.md** — Updated if routes, schemas, middleware stacks, or data flows changed.
- [ ] **SECURITY.md** — Updated if auth logic, logging, PII handling, key management, or CORS config changed.
- [ ] **DEPENDENCIES.md** — Updated if npm packages, Cloudflare bindings, external services, or env vars were added/removed/changed.
- [ ] **MAINTENANCE_CHECKLIST.md** — Updated if a new repeatable workflow, deploy step, or hygiene rule was introduced.
- [ ] **Last updated date** — Run `npx tsx scripts/docs_writer.ts ensure-headers` (or update manually) so the date on any modified doc reflects the change date.

### Quick reference — when to update which file

| Change type | Files to update |
|-------------|----------------|
| New API endpoint | ARCHITECTURE.md, TASKS.md |
| New D1 table / column | ARCHITECTURE.md, DEPENDENCIES.md, TASKS.md |
| New env var or secret | DEPENDENCIES.md, TASKS.md |
| Auth / HMAC / session change | SECURITY.md, ARCHITECTURE.md |
| New npm package | DEPENDENCIES.md |
| New external service | DEPENDENCIES.md, PROJECT_OVERVIEW.md |
| Bug fix (no arch change) | TASKS.md (mark done or add follow-up) |
| New repeatable workflow | MAINTENANCE_CHECKLIST.md |
| AI Assist feature change | ARCHITECTURE.md, TASKS.md |
