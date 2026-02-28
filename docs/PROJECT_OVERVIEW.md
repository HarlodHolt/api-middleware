# Olive & Ivory Gifts — Project Overview

> Last updated: 2026-02-28
> Owner: repo agent / Yuri
> Scope: Top-level project summary

## What Is This?

Olive & Ivory Gifts is a boutique e-commerce platform for a gift brand based in Canberra, Australia. It sells curated gift collections with local delivery and Stripe-powered checkout.

The project is split across **4 GitHub repos**, all owned by `HarlodHolt`, all deployed on the **Cloudflare** platform.

---

## The 4 Repos

| Repo | Local Path | Role | URL |
|------|-----------|------|-----|
| `api-middleware` | `/dev/` | Shared middleware package used by all other repos | npm package (git) |
| `olive_and_ivory_gifts` | `/dev/olive_and_ivory_gifts/` | Public-facing storefront | `https://oliveandivorygifts.com` |
| `admin_olive_and_ivory_gifts` | `/dev/admin_olive_and_ivory_gifts/` | Internal admin dashboard | `https://admin.oliveandivorygifts.com` |
| `olive_and_ivory_api` | `/dev/olive_and_ivory_api/` | Backend API worker | `https://api.oliveandivorygifts.com` |

---

## Repo Summaries

### 1. `api-middleware` (shared package)

A standalone TypeScript package (v0.1.1) that provides a unified middleware pipeline for Cloudflare Workers, Next.js, and Hono. All three other repos depend on it via a git reference in `package.json`.

**What it provides:**
- Middleware pipeline (`runPipeline`, `compose`)
- Request context enrichment (correlation IDs, IP, user-agent)
- CORS handling
- JSON body parsing with size limits
- HMAC-SHA256 authentication
- Rate limiting (D1 or memory)
- Structured request/response logging with sinks
- Standardised JSON error responses
- Platform adapters for Next.js, Cloudflare Workers, and Hono

**Key exports:** `withRequestContext`, `withCors`, `withJsonBody`, `withAuthHmac`, `withRateLimit`, `withLogging`, `withErrorHandling`, `jsonOk`, `jsonError`, `nextjs`, `cloudflare`, `hono`

---

### 2. `olive_and_ivory_gifts` (storefront)

A Next.js 15 App Router site deployed to Cloudflare Pages via `@opennextjs/cloudflare`. This is the customer-facing website.

**What customers can do:**
- Browse gift collections and variants
- Filter by category, brand, tags, price
- Add to cart
- Enter delivery address (Google Places autocomplete)
- Checkout via Stripe

**What it manages directly (via D1):**
- Browse catalog queries
- FAQ content
- Delivery zone lookups

**What it proxies to the API worker:**
- Order creation
- Payment webhooks
- Newsletter subscriptions
- Geocoding / delivery quotes

**Tech:** Next.js 15.5, React 19, Tailwind CSS 4, Stripe SDK, Zod, Cloudflare D1/R2

---

### 3. `admin_olive_and_ivory_gifts` (admin dashboard)

A Next.js 15 App Router site deployed to Cloudflare Pages for internal use. Protected by cookie-based session auth and optionally Cloudflare Access.

**What admins can do:**
- Manage collections, gifts, variants, and media
- View and update orders and delivery runs
- Manage inventory stock levels
- Configure delivery zones
- Manage FAQs and newsletter
- Use AI-assisted copy generation (OpenAI)
- View structured logs and audit trails
- Check system health (D1, R2, OpenAI, Stripe)
- Parse and manage receipts

**Tech:** Next.js 15.5, React 19, Tailwind CSS 4, PBKDF2 session auth, OpenAI integration, Zod

---

### 4. `olive_and_ivory_api` (backend API)

A Cloudflare Worker built with Hono. This is the single source of truth for all business data — it owns the database and all write operations.

**What it handles:**
- All CRUD for collections, gifts, items, orders, delivery zones, FAQs
- Stripe checkout session creation and webhook processing
- Google Places address autocomplete (with caching and rate limiting)
- Newsletter subscriptions via Brevo
- AI-assisted content generation via OpenAI
- Structured observability logs with retention pruning
- Health and diagnostic endpoints

**Auth:** All non-public routes require a valid HMAC-SHA256 signature (shared secret with both frontend apps). Public routes (health, delivery quote, Stripe webhook, Places autocomplete, newsletter) are open.

**Tech:** Hono, Cloudflare Workers, D1, R2, Stripe, OpenAI, Brevo, Google Places, Zod

---

## Infrastructure Overview

```
Cloudflare
├── Pages
│   ├── olive_and_ivory_gifts   (Next.js via OpenNext)
│   └── admin_olive_and_ivory_gifts  (Next.js via next-on-pages)
├── Workers
│   └── olive_and_ivory_api   (Hono)
├── D1 (SQLite)
│   └── Shared database between storefront and API
├── R2 (Object Storage)
│   └── Product images and gift media
└── Access (Optional)
    └── Admin SSO / pre-auth
```

## External Services

| Service | Used By | Purpose |
|---------|---------|---------|
| Stripe | API, Storefront | Payment processing, checkout sessions, webhooks |
| Google Places API | API, Storefront | Address autocomplete (AU only) |
| OpenAI (gpt-4.1-mini) | API, Admin | AI-assisted collection copy generation |
| Brevo | API | Email newsletter subscriptions |
| Cloudflare Access | Admin | Optional SSO/OAuth2 for admin login |

---

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Request flows and how repos connect
- [DEPENDENCIES.md](./DEPENDENCIES.md) — Package and service dependency map
- [TASKS.md](./TASKS.md) — Outstanding tasks and improvements
- [SECURITY.md](./SECURITY.md) — Vulnerabilities and security concerns
- [MAINTENANCE_CHECKLIST.md](./MAINTENANCE_CHECKLIST.md) — Regular checks when actively developing
