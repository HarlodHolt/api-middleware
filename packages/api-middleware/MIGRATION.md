# API Middleware Migration

Use this package for new API routes to keep request IDs, errors, logging, and rate limiting consistent.

## Next.js route handler

1. Wrap handler with `withApiLogging` (or `withNextJsPipeline` directly).
2. Keep business logic in handler body only.
3. Throw errors or return `Response`; middleware will normalize logging + error shape.

```ts
import { withNextJsPipeline, withRequestContext, withJsonBody, withLogging, withErrorHandling } from "api-middleware";

export const POST = withNextJsPipeline(
  [withRequestContext(), withJsonBody(), withLogging({ actionPrefix: "example.route" }), withErrorHandling()],
  async (request, _ctx, mwCtx) => {
    return Response.json({ ok: true, correlation_id: mwCtx.correlation_id });
  }
);
```

## Hono / Cloudflare Worker

1. Add pipeline once at app-level with `withHonoPipeline`.
2. Keep `withErrorHandling()` last in middleware array.
3. Remove duplicate local context/error/logging middleware.

```ts
app.use("*", withHonoPipeline([
  withRequestContext(),
  withRateLimit({ windowSeconds: 60, limit: 60 }),
  withJsonBody(),
  withLogging({ actionPrefix: "api.route" }),
  withErrorHandling(),
]));
```

## Standard response error shape

All middleware-generated errors return:

```json
{
  "ok": false,
  "error": {
    "code": "string",
    "message": "string",
    "correlation_id": "string"
  },
  "details": {}
}
```
