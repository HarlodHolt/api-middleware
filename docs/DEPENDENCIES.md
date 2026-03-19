# Dependencies

> Last updated: 2026-03-19
> Owner: repo agent / Yuri
> Scope: Inter-repo and external service dependency map

## Inter-Repo Dependencies

```
api-middleware (repo version: v0.1.4)
    ├── used by: olive_and_ivory_gifts  (git dependency, pinned v0.1.4)
    ├── used by: admin_olive_and_ivory_gifts  (git dependency, pinned v0.1.4)
    └── used by: olive_and_ivory_api  (git dependency, pinned v0.1.4)
```

All three application repos reference `api-middleware` as a **git dependency** in their `package.json` (`github:HarlodHolt/api-middleware#v0.1.4`). This means they pin to specific git tags rather than a published npm package.

**Implication:** When `api-middleware` is updated, each consuming repo must manually update its git reference and rebuild. There is no automatic version propagation.

---

## Package Dependencies by Repo

### api-middleware

| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.12.3 | Hono adapter support (only runtime dep) |

### olive_and_ivory_gifts (storefront)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.5.12 | React framework |
| `react` / `react-dom` | 19.1.5 | UI runtime |
| `tailwindcss` | 4 | Styling |
| `stripe` | 17.7.0 | Payment SDK |
| `zod` | 3.25.76 | Validation |
| `lucide-react` | 0.575.0 | Icons |
| `@opennextjs/cloudflare` | 1.16.5 | Cloudflare Pages adapter for Next.js 15 |
| `wrangler` | 4.66.0 | Cloudflare CLI |
| `@cloudflare/workers-types` | 4.20260219.0 | Type definitions |

### admin_olive_and_ivory_gifts (admin)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.5.12 | React framework |
| `react` / `react-dom` | 19.2.4 | UI runtime |
| `tailwindcss` | 4 | Styling |
| `zod` | 3.25.76 | Validation |
| `lucide-react` | 0.575.0 | Icons |
| `react-easy-crop` | 5.5.6 | Image cropping UI |
| `@cloudflare/next-on-pages` | 1.13.16 | Cloudflare Pages adapter (older adapter) |
| `wrangler` | 4.66.0 | Cloudflare CLI |
| `@cloudflare/workers-types` | 4.20260218.0 | Type definitions |
| `playwright` | (config present) | E2E test framework |

### olive_and_ivory_api (API worker)

| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.10.3 | Web framework |
| `stripe` | ^17.7.0 | Payment SDK |
| `zod` | ^3.25.76 | Validation |
| `typescript` | ^5.9.3 | Language |
| `wrangler` | ^4.67.0 | Cloudflare CLI |
| `@cloudflare/workers-types` | ^4.20260221.0 | Type definitions |

---

## Adapter Version Mismatch — Action Required

The two Next.js apps use **different Cloudflare adapters**:

| Repo | Adapter | Version |
|------|---------|---------|
| `olive_and_ivory_gifts` | `@opennextjs/cloudflare` | 1.16.5 |
| `admin_olive_and_ivory_gifts` | `@cloudflare/next-on-pages` | 1.13.16 |

`@cloudflare/next-on-pages` is the **older/deprecated** adapter. `@opennextjs/cloudflare` is the current recommended adapter for Next.js 15. The admin site should be migrated to `@opennextjs/cloudflare` for long-term support.

---

## React Version Mismatch — Minor

| Repo | React Version |
|------|--------------|
| `olive_and_ivory_gifts` | 19.1.5 |
| `admin_olive_and_ivory_gifts` | 19.2.4 |

Both are React 19, but different patch versions. Should be aligned.

---

## External Service Dependencies

| Service | Repos | Env Var | Criticality |
|---------|-------|---------|------------|
| Cloudflare D1 | All 3 apps | `DB` binding | Critical — all data |
| Cloudflare R2 | API Worker | `BUCKET` binding | High — all images |
| Stripe | API Worker, Storefront | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Critical — payments |
| Google Places API | Storefront, API Worker | `GOOGLE_PLACES_SERVER_KEY` | High — address entry |
| OpenAI | API Worker | `OPENAI_API_KEY` | Medium — AI copy gen |
| Brevo | API Worker | `BREVO_API_KEY` | Low — newsletter only |
| Cloudflare Access | Admin | (platform-managed) | Medium — admin auth |

---

## D1 Database — Shared Dependency

All 4 repos (storefront reads, admin reads/writes via API, API worker owns) share the same D1 database instance. The API worker is the single authoritative writer for business data.

**Schema is managed via migrations in each repo:**
- `olive_and_ivory_api/migrations/` — owns the canonical schema
- `olive_and_ivory_gifts/migrations/` — may have storefront-specific migrations
- `admin_olive_and_ivory_gifts/migrations/` — admin-specific tables (users, sessions)

**Risk:** Migrations are not coordinated via a single source of truth. Running migrations from the wrong repo could cause schema drift.

---

## api-middleware as a Git Dependency — Risks

Currently installed as a git reference like:
```json
"api-middleware": "github:HarlodHolt/api-middleware#v0.1.1"
```

| Risk | Description |
|------|-------------|
| No automatic updates | Consumer repos must manually bump the git ref |
| No changelogs enforced | Breaking changes may be missed |
| No npm audit coverage | npm audit does not scan git dependencies |
| Build-time resolution | Slower installs; requires git access during CI |

**Recommendation:** Publish `api-middleware` to npm (private or public) so consumers can use semantic versioning and `npm audit`.
