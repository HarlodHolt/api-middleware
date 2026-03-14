# Decisions

## Purpose

Durable technical and product decisions that should keep future work consistent.

## Current Decisions

### Platform

- `api-middleware` is the shared middleware layer used across the other repos.
- Runtime code must remain Cloudflare/Edge-safe.

### API Contracts

- Preserve and propagate `x-correlation-id` and `x-request-id`.
- Standard error shape is:
  - `{ ok: false, error: { code, message, correlation_id }, details? }`

### Data Ownership

- The API worker is the primary writer for business entities.
- Frontend apps may proxy to the API rather than writing directly.

### AI

- AI schema ownership is entity-driven, not prompt-driven.
- Prompt text should define behaviour and tone, not output structure.
- Prompt library content should stay in D1-backed settings rather than editor-local hardcoded lists.

### Deploy Safety

- Deploy from clean worktrees when the local repo has unrelated unstaged changes.
- Git pre-push hook is enforced via `core.hooksPath=.githooks` and runs `npm run test:prepush`.
- CI must remain secret-safe: use test commands that do not require Cloudflare secrets/bindings.

### Shared Secrets (HMAC)

- **Pages apps (storefront, admin):** `HMAC_SHARED_SECRET` must be set via `wrangler pages secret put` only. Do NOT add `[vars] HMAC_SHARED_SECRET` to wrangler.toml — it conflicts with Pages secrets and causes "Binding name already in use" deploy failures.
- **API worker:** `HMAC_SHARED_SECRET` is set via `[vars]` in wrangler.toml (Workers don't have this conflict).
- The storefront uses a local `src/lib/signing.ts` (self-contained, no `api-middleware` import) because OpenNext cannot resolve `api-middleware` runtime exports.
- **"Invalid signature" errors** almost always mean the secret value differs between the API worker and the calling frontend.

### Storefront Build

- `.env.production` sets `API_BASE_URL=https://api.oliveandivorygifts.com` — Next.js bakes this at build time.
- `.env.development.local` sets localhost values for `next dev` only.
- Never put `API_BASE_URL` in `.env.local` — it gets baked into production builds.
- Deploy from `.open-next/assets` (not `.open-next/cloudflare`).

## Update Triggers

- Any change that alters future implementation across more than one task
- Any new platform or contract rule that should be applied consistently
