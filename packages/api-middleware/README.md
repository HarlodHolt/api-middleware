# API Middleware Update
We have unified the API middleware processing under `/packages/api-middleware`. This provides a consistent pipeline for Cloudflare Workers (Hono) and Next.js Route Handlers.

## How to add a new API route using the middleware

### Next.js
In Next.js, use `withApiLogging` from `@/lib/api-logging` which wraps the shared `withNextJsPipeline`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/api-logging";

async function POSTHandler(req: NextRequest, ctx: any) {
  // context is available natively inline.
  // req body is pre-parsed in mwState or available normally.
  return NextResponse.json({ success: true });
}

export const POST = withApiLogging(POSTHandler, { actionPrefix: "my.new.route" });
```

### Cloudflare (Hono)
The pipeline is already registered globally in `src/index.ts`:

```ts
// src/index.ts
...
app.use("*", withHonoPipeline([
  withRequestContext(),
  withErrorHandling(),
  withLogging(),
  withRateLimit({ windowSeconds: 60, limit: 60 })
]));
```
Any standard `.get()` or `.post()` you add to Hono will automatically be covered by the context, auth, logging, and error-handling pipelines securely.

To strictly require HMAC on a new sub-router, just use:
```ts
app.use("/secure/*", withHonoPipeline([
   withAuthHmac({ secretEnvKey: "HMAC_SHARED_SECRET" })
]));
```
