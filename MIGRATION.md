# MIGRATION

## 1) Remove duplicated middleware in each app

Delete local request-id/error/logging wrappers in main/admin/api repos and use this package pipeline.

## 2) Install dependency pinned to release tag

```bash
npm install git+ssh://git@github.com/HarlodHolt/api-middleware.git#v0.1.0
```

## 3) Next.js route handler usage

```ts
import { nextjs, withErrorHandling, withJsonBody, withLogging, withRequestContext } from "api-middleware";

export const POST = nextjs(
  [withRequestContext(), withJsonBody(), withLogging(), withErrorHandling()],
  async (request, _appContext, middlewareContext) => {
    return Response.json({ ok: true, correlation_id: middlewareContext.correlation_id });
  }
);
```

## 4) Cloudflare Worker usage

```ts
import { cloudflare, withErrorHandling, withLogging, withRequestContext } from "api-middleware";

export default {
  fetch: cloudflare([withRequestContext(), withLogging(), withErrorHandling()], async (_request, _env, context) => {
    return Response.json({ ok: true, request_id: context.request_id });
  })
};
```

## 5) Hono usage

```ts
import { Hono } from "hono";
import { hono, withErrorHandling, withLogging, withRequestContext } from "api-middleware";

const app = new Hono();
app.use("*", hono([withRequestContext(), withLogging(), withErrorHandling()]));
```

## 6) Correlation propagation + Log Explorer

- Client/UI should display `x-correlation-id` (or error body `error.correlation_id`) in failure states.
- Logs endpoint should preserve the canonical error shape and headers so admin diagnostics remain consistent.
