# Local Cloudflare Remote Dev

Use this workflow when you want to run code locally but exercise Cloudflare-hosted
data services before pushing.

## API Worker

The API worker now has an explicit remote-binding config at
`olive_and_ivory_api/wrangler.remote.toml`.

Run it with:

```bash
cd /Users/yuri_baker/dev/olive_and_ivory_api
npm run dev:remote
```

That keeps normal `npm run dev` on local emulated bindings, while `npm run dev:remote`
runs the worker locally against the configured Cloudflare D1 and R2 bindings.

## Storefront

The storefront can point at the local API worker while still using the worker's remote
D1/R2 bindings indirectly.

Create `olive_and_ivory_gifts/.env.local` from `olive_and_ivory_gifts/.env.local.example`
and set:

```bash
API_BASE_URL=http://127.0.0.1:8787
HMAC_SHARED_SECRET=<same secret the API worker expects>
```

Then run:

```bash
cd /Users/yuri_baker/dev/olive_and_ivory_gifts
npm run dev
```

## Admin

The admin app is still on `@cloudflare/next-on-pages`. Its local `next dev` flow does
not provide remote D1 bindings. For now:

- use the API worker `dev:remote` path for end-to-end flows that can go through the API
- use `npm run preview` in the admin app when you need Pages-style local binding emulation

Once the admin app is migrated to `@opennextjs/cloudflare`, it can use the same local
Cloudflare context pattern as the storefront.

## Safety

`wrangler.remote.toml` currently points at the existing configured resources. If you add
staging D1 and R2 resources, update that file to use the staging IDs/names so local
remote testing cannot touch production data.
