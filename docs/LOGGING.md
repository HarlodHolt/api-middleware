# Logging Reference

> Last updated: 2026-03-10
> Owner: repo agent / Yuri
> Scope: `api-middleware`, `olive_and_ivory_api`, `admin_olive_and_ivory_gifts`

## Overview

Logs are written to `event_logs` in D1 from three places:

1. Automatic HTTP logs via `api-middleware` `withLogging()`.
2. API worker domain logs via `olive_and_ivory_api/src/lib/logger.ts` `logEvent()`.
3. Admin app domain logs via `admin_olive_and_ivory_gifts/src/lib/logging.ts` `logEvent()`.

The Admin Log Explorer reads logs from API endpoints (`/logs`, `/logs/:id`) and displays normalized rows.

## Event Logs Table (D1)

Current schema (both API and Admin migrations):

- `id` `TEXT` primary key
- `created_at` `TEXT`
- `level` `TEXT` (`debug|info|warn|error|security` depending on producer)
- `source` `TEXT` (commonly `api`, `admin`, `worker`, `server`, `ui`)
- `action` `TEXT`
- `correlation_id` `TEXT`
- `user_email` `TEXT` nullable
- `user_id` `TEXT` nullable
- `entity_type` `TEXT` nullable
- `entity_id` `TEXT` nullable
- `message` `TEXT`
- `data_json` `TEXT` nullable
- `request_id` `TEXT` nullable
- `event_type` `TEXT` nullable (`http|audit|security|job|legacy`)
- `ip_address` `TEXT` nullable
- `duration_ms` `INTEGER` nullable
- `method` `TEXT` nullable
- `path` `TEXT` nullable
- `status_code` `INTEGER` nullable
- `metadata` `TEXT` nullable

## Common Field Meanings

- `correlation_id`: Trace ID propagated across services (`x-correlation-id`), generated if missing.
- `request_id`: Request ID (usually `cf-ray` fallback), generated if missing.
- `action`: Logical operation label for filtering (for example `http.response`, `orders.refund`, `auth.login`).
- `source`: Producer category (`api`, `admin`, etc.).
- `event_type`: Category label (`http`, `audit`, `security`, `job`).
- `data_json`: Canonical structured payload for detail view and machine parsing.
- `metadata`: Extra producer metadata (legacy + compatibility path).

## Automatic HTTP Logging (`api-middleware`)

Source: `src/runtime/middlewares/logger.ts`.

The middleware emits one log per request/response (or thrown error) with:

- top-level columns:
  - `level` from HTTP status (`info`, `warn`, `error`)
  - `action` = `<action_prefix|http>.<method>.<route>.<outcome>`
    - example: `orders.get_api_orders_id.ok`
  - `message` = `METHOD path -> status`
  - `correlation_id`, `request_id`, `method`, `route` (written as `path`), `status`, `duration_ms`, `ip`, `user_agent`, `user_id`, `user_email`
- `metadata` payload:
  - `user_agent`
  - `ip_address`
  - `request_json.query`
  - `request_json.parsed_body_keys`
  - `response_json` (only when response content type is JSON)
  - `auth_action`
  - `rate_limit_action`
  - `legacy_action` (`http.response` / `http.error`) for compatibility

Empty/null metadata branches are now pruned before writing.

### Sampling behavior

`withLogging()` currently samples `info` logs using:

- `LOG_SAMPLE_RATE_INFO` (default `1.0`)
- `LOG_ALWAYS_LOG_SLOW_MS` (default `1500` ms; always logged when exceeded)
- `warn` and `error` are always logged

If traffic volume is too high, reduce `LOG_SAMPLE_RATE_INFO` explicitly.

## API Worker Manual Logging

Source: `olive_and_ivory_api/src/lib/logger.ts`.

`logEvent()` writes canonical payload into `data_json` and stores request-context columns when provided.

Canonical `data_json` structure:

- `request_id`
- `correlation_id`
- `time`
- `level`
- `source`
- `action`
- `message`
- `http`:
  - `method`
  - `path`
  - `query`
  - `status`
  - `duration_ms`
  - `ip`
  - `user_agent`
  - `user.id`
  - `user.email`
- `request`
- `response`
- `meta`
- `extra` (optional non-canonical payload residue)

## Admin App Manual Logging

Source: `admin_olive_and_ivory_gifts/src/lib/logging.ts`.

`logEvent()` writes the same canonical structure as API and adds:

- sensitive-key redaction (`authorization`, `cookie`, `token`, `password`, etc.)
- payload truncation guard (`MAX_DATA_BYTES`)
- table retention trimming to `MAX_EVENT_LOG_ROWS`

## Why Fields Are Empty In Log Explorer

Expected empty values are common for these reasons:

1. Producer does not provide a field (for example `user_email` on unauthenticated requests).
2. Older rows were inserted before newer columns were added.
3. Non-HTTP domain events often do not have `method`, `path`, or `status_code`.
4. `request`/`response` payloads may be absent when producers only send summary metadata.
5. Middleware logger stores detailed request/response inside JSON payload, not always as dedicated columns.

## Current Pain Points

1. Some producers still write sparse rows (expected for non-HTTP events).
2. Historic rows remain null-heavy because normalization and pruning are not retroactive.
3. High-volume environments may need custom sampling to balance cost vs traceability.

## Suggested Next Steps

1. Backfill/compact old null-heavy rows if cleaner historical views are required.
2. Add a per-route override mechanism for sampling rather than only global env-based sampling.
