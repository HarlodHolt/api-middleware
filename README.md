# api-middleware

Edge-safe TypeScript middleware package for Next.js Route Handlers, Cloudflare Workers/Pages, and Hono.

## Contracts

- Request IDs: inbound `x-correlation-id` is preserved when present; otherwise generated.
- Response headers: every pipeline response includes `x-correlation-id` and `x-request-id`.
- Error JSON shape:

```json
{ "ok": false, "error": { "code": "string", "message": "string", "correlation_id": "string" }, "details": {} }
```

- Status mapping:
  - validation: 400
  - auth/hmac: 401 or 403
  - constraint conflict: 409
  - rate limit: 429 + `Retry-After`
  - unknown: 500

- Log schema (`LogEvent`):
  - `level`, `action`, `message`, `correlation_id`, `request_id`, `route`, `method`, `status`, `duration_ms`, `ip`, `user_agent`, `user_id?`, `metadata?`
  - sensitive values are redacted and metadata is truncated by default.

## Public API

- `compose()`
- middleware:
  - `withRequestContext`, `withEnvValidation`, `withCors`, `withJsonBody`
  - `withAuthHmac`, `withRateLimit`, `withLogging`, `withErrorHandling`
- adapters:
  - `nextjs`, `cloudflare`, `hono`
- helpers:
  - `jsonOk`, `jsonError`, `noContent`, `redirect`
- sinks:
  - `ConsoleSink`, `D1EventLogsSink`
- types:
  - `AppEnv`, `RequestContext`, `ApiError`, `ApiResult`, `LogEvent`
  - `RateLimitConfig`, `AuthHmacConfig`, `PaginationResult`

## Install (pin to release tag)

```bash
npm install git+ssh://git@github.com/HarlodHolt/api-middleware.git#v0.1.0
```

## Scripts

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run guard:runtime`

## Examples

See [examples/nextjs-route](./examples/nextjs-route), [examples/cloudflare-worker](./examples/cloudflare-worker), and [examples/hono](./examples/hono).
