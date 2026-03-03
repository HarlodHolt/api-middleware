# Local Testing

> Last updated: 2026-03-03
> Owner: repo agent / Yuri
> Scope: Commands and workflows for testing the local repos before pushing

Use this as the quick reference for what can be run locally in each repo.

---

## Shared Notes

- Run commands from the repo they belong to.
- `npm run dev` is for local iteration; build and lint commands are the minimum pre-push checks.
- The API worker supports a remote-data local harness via `npm run dev:remote`.
- The storefront can point at the local API worker by setting `API_BASE_URL=http://127.0.0.1:8787` in `.env.local`.
- The admin app is still on `@cloudflare/next-on-pages`, so its plain `next dev` flow does not provide remote D1 bindings.

---

## Root Repo (`/Users/yuri_baker/dev`)

This repo is the `api-middleware` package.

```bash
npm run build
npm run lint
npm run typecheck
npm run test
npm run guard:runtime
npm run pack:check
```

Use these when changing middleware behavior, adapters, runtime helpers, or package exports.

---

## API Worker (`/Users/yuri_baker/dev/olive_and_ivory_api`)

### Main commands

```bash
npm run dev
npm run dev:remote
npm run build
npm run test:collection-ai-schema
npm run test:gift-item-relations
npx tsc --noEmit
```

### Useful manual probes

Start the worker first with `npm run dev` or `npm run dev:remote`, then run:

```bash
curl -i http://127.0.0.1:8787/health
curl -i http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/health/d1
curl -i http://127.0.0.1:8787/api/health/r2
curl -i -X POST http://127.0.0.1:8787/api/newsletter/subscribe -H 'Content-Type: application/json' -d '{"email":"invalid"}'
```

Use `npm run dev:remote` when you want local code against the configured Cloudflare D1/R2 resources.

---

## Storefront (`/Users/yuri_baker/dev/olive_and_ivory_gifts`)

### Main commands

```bash
npm run dev
npm run lint
npm run build:next
npm run pages:verify-output
npm run pages:build
npm run preview
```

### Recommended local API integration flow

1. Start the API worker in `olive_and_ivory_api` with `npm run dev:remote`.
2. Create `olive_and_ivory_gifts/.env.local` from `.env.local.example`.
3. Set `API_BASE_URL=http://127.0.0.1:8787`.
4. Run `npm run dev` in the storefront repo.

This lets the UI exercise the local worker while the worker uses remote Cloudflare bindings.

---

## Admin (`/Users/yuri_baker/dev/admin_olive_and_ivory_gifts`)

### Main commands

```bash
npm run dev
npm run lint
npm run build
npm run pages:build
npm run preview
npm run migrations:validate
npm run migrations:apply:local
npm run migrations:apply:local:schema
npm run ci:deploy-check
npm run test:ai-copy
npm run test:logs-endpoint
npm run test:editor-platform-contracts
```

### Notes

- Use `npm run preview` when you need the Pages-style local runtime.
- `npm run migrations:apply:remote:schema` and `npm run migrations:reconcile:remote` touch remote D1 state; treat them as production-impacting commands.

---

## Suggested Minimum Pre-Push Checks

If you want the shortest sensible local check set:

```bash
cd /Users/yuri_baker/dev && npm run lint && npm run test
cd /Users/yuri_baker/dev/olive_and_ivory_api && npx tsc --noEmit && npm run build
cd /Users/yuri_baker/dev/olive_and_ivory_gifts && npm run lint && npm run pages:build
cd /Users/yuri_baker/dev/admin_olive_and_ivory_gifts && npm run lint && npm run build
```

If the change is isolated to one repo, run the matching subset instead of the full set.
