# Architecture — How the Repos Interlink

> Last updated: 2026-02-28
> Owner: repo agent / Yuri
> Scope: System architecture and request flows

## High-Level Flow

```
Browser (customer)
    │
    ▼
oliveandivorygifts.com  (Cloudflare Pages — Next.js)
    │
    ├── Direct D1 reads:  catalog, FAQs, delivery zones (via Cloudflare binding)
    │
    └── Signed HTTP → api.oliveandivorygifts.com  (Cloudflare Worker — Hono)
            │
            ├── D1 writes: orders, newsletter, etc.
            ├── Stripe: checkout session creation
            └── Google Places: address autocomplete

Browser (admin)
    │
    ▼
admin.oliveandivorygifts.com  (Cloudflare Pages — Next.js)
    │
    └── Signed HTTP → api.oliveandivorygifts.com
            │
            ├── Full CRUD: collections, gifts, items, orders
            ├── OpenAI: AI copy generation
            ├── R2: image upload/management
            └── Logs/audit: D1 event_logs, audit_logs
```

---

## HMAC Signing — How Frontend Calls the API

Both the storefront and admin site make server-side HTTP requests to the API worker. Every request is signed using HMAC-SHA256.

**Canonical signing string:**
```
METHOD\n
{pathname}{search}\n
{unix_timestamp_seconds}\n
{nonce (UUID)}\n
{sha256_hex(request_body or "")}
```

**Headers sent:**
- `x-oi-timestamp` — Unix seconds
- `x-oi-nonce` — Unique UUID per request
- `x-oi-signature` — Base64-encoded HMAC-SHA256 signature
- `x-correlation-id` — Propagated for tracing

**Secret:** `HMAC_SHARED_SECRET` env var, set on both Pages and the Worker.

The `api-middleware` package provides `withAuthHmac()` on the API side and `createHmacSignature()` / `verifyHmacSignature()` helpers on the client side.

---

## Request ID Propagation (Tracing)

Every request gets two IDs:

| ID | Source | Propagated Via |
|----|--------|----------------|
| `correlation_id` | Inbound `x-correlation-id` header or generated UUID | Response header + logs |
| `request_id` | CF-Ray header or fallback UUID | Response header + logs |

These flow from the browser → storefront → API worker → D1 logs, so any request can be traced end-to-end across all services.

---

## Storefront → API: Proxy Pattern

The Next.js storefront does **not** call the API worker from the browser. Instead:

1. Browser calls a local Next.js API route (e.g. `/api/orders`)
2. The Next.js route signs the request with HMAC
3. It proxies to `https://api.oliveandivorygifts.com/api/orders`
4. Returns the response to the browser

This keeps `HMAC_SHARED_SECRET` server-side only and avoids exposing the API URL directly to the browser.

---

## Storefront Direct D1 Access

Some read-only data is fetched directly from D1 by the storefront (bypassing the API worker):

- Browse catalog (`/api/browse/items`) — SQL queries via D1 binding
- FAQs — direct D1 read
- Delivery zone lookups — direct D1 read
- R2 public URL — read from `settings` table in D1

This is a performance optimisation — avoids double-hop for read-only data.

---

## Admin → API: Full CRUD

The admin site proxies all data operations to the API worker. Nothing is written to D1 directly from the admin — it all goes through the worker.

Writes flow:
```
Admin browser → Admin Next.js route → [HMAC sign] → API Worker → D1
```

---

## Middleware Stack (api-middleware)

All three apps use the shared `api-middleware` package. A typical middleware stack looks like:

```
Request
  ↓ withRequestContext()  — enrich context with IDs, IP, user info
  ↓ withEnvValidation()   — check required env bindings present
  ↓ withCors()            — handle OPTIONS / attach CORS headers
  ↓ withJsonBody()        — parse JSON body (16KB default limit)
  ↓ withAuthHmac()        — verify HMAC signature (skipped on public routes)
  ↓ withRateLimit()       — sliding window counter (D1 or memory)
  ↓ withLogging()         — start timer, log on response
  ↓ withErrorHandling()   — catch exceptions, classify, return jsonError
  ↓ Handler               — business logic
```

---

## Stripe Payment Flow

```
1. Customer fills checkout form (storefront)
2. POST /api/checkout/create (storefront Next.js route)
3. [HMAC sign] POST /stripe/create-checkout-session (API worker)
4. API creates Stripe checkout session, returns checkout_url
5. Storefront redirects browser to checkout_url (Stripe-hosted page)
6. Customer pays on Stripe
7. Stripe fires webhook → POST /api/stripe/webhook (storefront proxy)
8. Storefront proxies webhook → POST /stripe/webhook (API worker)
9. API verifies Stripe signature, updates order status in D1
10. Browser on /order-confirmation polls or receives redirect from Stripe
```

---

## Image Storage Flow (R2)

```
Admin uploads image
    ↓
POST /api/gifts/:id/media (Admin Next.js route)
    ↓ [HMAC sign]
POST /gifts/:id/media (API worker)
    ↓
Store in R2 bucket (image_key = unique path)
    ↓
Return image_key to admin client

Storefront renders image:
    R2_PUBLIC_URL (from D1 settings table) + image_key
    → https://assets.oliveandivorygifts.com/{image_key}
```

---

## AI Copy Generation Flow

```
Admin triggers AI suggest for a collection
    ↓
POST /api/admin/collections/:id/ai-suggest (Admin Next.js route)
    ↓ [HMAC sign]
POST /admin/collections/:id/ai-suggest (API worker)
    ↓
Fetch prompt template from ai_prompts table (D1)
    ↓
Fill template with collection data
    ↓
Call OpenAI gpt-4.1-mini
    ↓
Return structured JSON (name, description, tags, etc.)
    ↓
Admin reviews + applies to collection
    ↓ [HMAC sign]
PUT /collections/:id (API worker) → D1 update
```

---

## Environment Variables — Who Needs What

| Variable | Storefront | Admin | API Worker |
|----------|-----------|-------|-----------|
| `HMAC_SHARED_SECRET` | ✓ (signs requests) | ✓ (signs requests) | ✓ (verifies) |
| `API_BASE_URL` | ✓ | ✓ | — |
| `DB` (D1 binding) | ✓ | ✓ | ✓ |
| `BUCKET` (R2 binding) | — | — | ✓ |
| `GOOGLE_PLACES_SERVER_KEY` | ✓ | — | ✓ |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✓ | — | — |
| `STRIPE_SECRET_KEY` | — | — | ✓ |
| `STRIPE_WEBHOOK_SECRET` | — | — | ✓ |
| `OPENAI_API_KEY` | — | — | ✓ |
| `BREVO_API_KEY` | — | — | ✓ |
| `R2_PUBLIC_URL_OVERRIDE` | optional | — | — |

---

## Database — Who Owns What

The API worker is the **single writer** for business data. The storefront reads some tables directly (read-only).

| Table | Writer | Readers |
|-------|--------|---------|
| `collections` | API Worker | Storefront (browse), Admin |
| `gifts` / `items` | API Worker | Storefront (browse), Admin |
| `orders` | API Worker | Admin |
| `event_logs` | API Worker, Admin | Admin |
| `audit_logs` | API Worker | Admin |
| `settings` | Admin → API | Storefront (R2_PUBLIC_URL), API |
| `delivery_zones` | Admin → API | Storefront (direct), API |
| `faqs` | Admin → API | Storefront (direct) |
| `ai_prompts` | Admin → API | API |
| `sessions` / `users` | Admin | Admin |
| `newsletter_signups` | API Worker | Admin |
| `gift_media` | API Worker | Storefront (images), Admin |
