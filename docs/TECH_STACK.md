# Tech Stack

> Last updated: 2026-03-15
> Owner: Yuri
> Scope: Complete technology inventory for the Olive & Ivory Gifts platform

---

## Platform

| Layer | Technology |
|-------|-----------|
| Hosting | Cloudflare — Pages (frontends), Workers (API) |
| Database | Cloudflare D1 (SQLite-based) |
| Object Storage | Cloudflare R2 (images/media) |
| CDN / Auth Gateway | Cloudflare Access (admin SSO) |

---

## Storefront — `oliveandivorygifts.com`

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js | 15 |
| UI Runtime | React | 19.1.5 |
| Styling | Tailwind CSS | 4 |
| CF Adapter | @opennextjs/cloudflare | 1.16.5 |
| Icons | Lucide React | 0.575.0 |
| Validation | Zod | 3.25.76 |
| Payments (client) | Stripe SDK | 17.7.0 |
| CLI | Wrangler | 4.66.0 |

---

## Admin — `admin.oliveandivorygifts.com`

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js | 15 |
| UI Runtime | React | 19.2.4 |
| Styling | Tailwind CSS | 4 |
| CF Adapter | @cloudflare/next-on-pages | 1.13.16 |
| Icons | Lucide React | 0.575.0 |
| Image Cropping | react-easy-crop | 5.5.6 |
| Validation | Zod | 3.25.76 |
| E2E Testing | Playwright | — |
| CLI | Wrangler | 4.66.0 |

> **Note:** The admin adapter (`@cloudflare/next-on-pages`) is deprecated. Migration to `@opennextjs/cloudflare` is tracked in the task backlog.

---

## API Worker — `api.oliveandivorygifts.com`

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Hono | ^4.10.3 |
| Payments | Stripe SDK | ^17.7.0 |
| Validation | Zod | ^3.25.76 |
| Language | TypeScript | ^5.9.3 |
| CLI | Wrangler | ^4.67.0 |

---

## Shared — `api-middleware`

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Hono (adapter support) | ^4.12.3 |
| Distribution | Git dependency (GitHub) | v0.1.2 |

Provides: HMAC auth (`withAuthHmac`), rate limiting (`withRateLimit`), CORS (`withCors`), structured logging (`withLogging`), error handling (`withErrorHandling`), request context enrichment (`withRequestContext`), env validation (`withEnvValidation`), JSON body parsing (`withJsonBody`).

---

## External Services

| Service | Purpose | Consumer(s) |
|---------|---------|-------------|
| Stripe | Payments and webhooks | API Worker, Storefront |
| Google Places API | Address autocomplete | Storefront, API Worker |
| OpenAI (gpt-4.1-mini) | AI copy generation for collections | API Worker |
| Brevo | Newsletter and transactional email | API Worker |
| Cloudflare Access | Admin SSO gateway | Admin |

---

## Dev Tooling

| Tool | Scope | Purpose |
|------|-------|---------|
| Biome | api-middleware (root) | Linting and formatting |
| ESLint | Storefront, Admin | Linting |
| Node test runner | All repos | Unit and integration tests |
| Playwright | Storefront, Admin | E2E and smoke tests |
| Custom test harness | Root (`scripts/local-test-harness.mjs`) | Cross-repo pre-push gate |
| Git hooks | Root (`.githooks/pre-push`) | Enforces test suite before push |

---

## Known Mismatches

| Issue | Detail | Status |
|-------|--------|--------|
| Adapter mismatch | Admin uses deprecated `next-on-pages`; storefront uses `@opennextjs/cloudflare` | Tracked in backlog |
| React patch version | Storefront 19.1.5 vs Admin 19.2.4 | Minor — should align |
| api-middleware pinning | Consumers pinned to v0.1.1; middleware repo at v0.1.2 | Manual bump needed |
| Linter mismatch | Biome (root) vs ESLint (Next.js apps) | Intentional for now |
