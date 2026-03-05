# Deep-Dive Review — Day 006

**Date:** 2026-03-05  
**Target type:** System  
**Target:** Log Explorer end-to-end observability pipeline (ingestion, normalization, and route coverage)  
**Primary file:** `admin_olive_and_ivory_gifts/src/app/api/logs/route.ts` (263 LOC)  
**Reviewer:** Codex  
**Status:** Complete

---

## Target Summary

This review covers how request/activity logs are written into `event_logs`, how `/api/logs` and `/api/logs/:id` normalize those rows for Log Explorer, and which app routes are currently instrumented versus silent.

The objective is a uniform table/detail experience in Log Explorer. Current behavior is partially uniform but still fragmented across multiple log writers and payload conventions.

---

## A. Usage Mapping

### A1. Entry Points

| Caller | Repo | Runtime | Method | Trust Level |
|--------|------|---------|--------|-------------|
| Log Explorer UI (`/logs`) | `admin_olive_and_ivory_gifts` | Next.js client | GET `/api/logs` + GET `/api/logs/:id` | Admin authenticated |
| Admin proxy log API | `admin_olive_and_ivory_gifts` | Next.js edge route | signed upstream fetch to API worker `/logs` | Internal server-to-server + HMAC |
| API worker log query API | `olive_and_ivory_api` | Cloudflare Worker (Hono) | SQL read from `event_logs` (+ AI run unions) | HMAC-authenticated caller |
| Request middleware logging | `api-middleware` used by API/admin | Worker + Next route wrappers | per-request auto log write | Platform/internal |
| Explicit route logging helpers | API/admin/storefront repos | mixed | direct `logEvent` / `writeEventLog` calls | app-defined |

### A2. Import / Reference Map

| Symbol | File | Line | Purpose |
|--------|------|------|---------|
| `withRequestContext()` | `src/runtime/middlewares/basic.ts` | 5 | Captures correlation/request IDs, IP, user-agent, route, method |
| `withLogging()` | `src/runtime/middlewares/logger.ts` | 68 | Auto request/response logging with sampling |
| `D1EventLogsSink` | `src/runtime/logging.ts` | 112 | Writes middleware logs to `event_logs` |
| `logEvent()` (API) | `olive_and_ivory_api/src/lib/logger.ts` | 95 | Canonical API/admin worker log writer |
| `logEvent()` (Admin) | `admin_olive_and_ivory_gifts/src/lib/logging.ts` | 95 | Canonical admin app log writer |
| `writeEventLog()` | `olive_and_ivory_gifts/src/lib/eventLogs.ts` | 33 | Storefront log writer |
| `logPlacesEvent()` | `olive_and_ivory_gifts/src/lib/placesProxy.ts` | 134 | Specialized Places logging |
| Admin log normalization | `admin_olive_and_ivory_gifts/src/app/api/logs/route.ts` | 7 | Normalizes mixed row payloads |
| API log normalization | `olive_and_ivory_api/src/routes/logs.ts` | 23 | Canonicalizes `data_json` for API response |

### A3. Call Graph (abbreviated)

```text
Route handler (API/Admin/Storefront)
  -> middleware and/or manual log helper
      -> INSERT event_logs (D1)
          -> API worker /logs query + normalization
              -> Admin /api/logs proxy + secondary normalization
                  -> Log Explorer table/detail UI
```

### A4. Data Flow Summary

1. Requests enter route handlers (or middleware pipelines).
2. Logs are written via one of four writer paths with different payload rules.
3. `event_logs` stores both first-class columns (status, path, ip, etc.) and JSON blobs (`data_json`, `metadata`).
4. API `/logs` normalizes rows to canonical payload shape.
5. Admin `/api/logs` normalizes again to handle legacy/variant payloads.
6. Log Explorer UI renders table rows and detail modal from normalized output.

### A5. Trust Boundaries Crossed

| From | To | Mechanism | Trust established by |
|------|----|-----------|----------------------|
| Browser -> storefront/admin route | HTTPS | public internet | app validation/rate limits |
| Storefront/admin route -> API worker | signed fetch | HMAC headers | `withAuthHmac` |
| API/admin/storefront -> D1 | prepared SQL | env-bound DB | platform binding |

---

## B. Database and Data Flow

### B1. D1 Tables Accessed

| Table | Operation | Fields Read | Fields Written | Notes |
|-------|-----------|-------------|----------------|-------|
| `event_logs` | INSERT | — | core columns + `data_json` + `metadata` | all writers |
| `event_logs` | SELECT | many, schema-dependent | — | API `/logs` and `/logs/:id` |
| `gift_ai_runs`, `collection_ai_runs` | SELECT | AI run fields | — | merged into `/logs` feed |

### B2. Transactions and Atomicity

Logging writes are single INSERT statements with fail-safe behavior. Failure to write logs intentionally does not fail user requests.

### B3. External APIs Touched

Indirectly through logged routes (Stripe, Google Places, OpenAI, etc.). Log Explorer pipeline itself only queries D1.

### B4. R2 / KV / Cache Usage

No persistent cache in log pipeline; some route-level in-memory caches (for Places) influence which requests are logged.

### B5. Legacy Schema Observations

- `event_logs` had progressive hardening migrations (`0002_event_logs_observability_hardening.sql`).
- Writers still contain legacy insert fallbacks (reduced column set), so row shape can vary.

### B6. Index and Performance Observations

- `event_logs` has useful indexes (`event_type`, `ip_address`, `status_code`, `created_at DESC`).
- Dual normalization (API then admin) is defensive but expensive and complexity-heavy.

---

## C. Security Review

### C1. Authentication / Authorization

Log query endpoints are reached via admin-authenticated UI and HMAC-signed server-to-worker calls.

### C2. Input Validation

`/logs` filters validate limit/status/date, reducing obvious injection and abuse risk.

### C3. Injection Risks

Observed SQL uses parameter binding; no raw string interpolation of user-controlled values in predicates.

### C4. PII Handling

Redaction utilities exist in shared middleware and admin/api loggers, but the storefront writer (`writeEventLog`) does not centrally enforce redaction.

### C5. Primary Security/Privacy Findings

1. **REVIEW-006-001 (P1): IP provenance degradation on proxied calls.**  
   Storefront/admin `signedApiFetch` does not forward `cf-connecting-ip` or `x-forwarded-for`, so API worker middleware can record proxy/server IP or null for those paths.

2. **REVIEW-006-002 (P1): user-agent is captured but frequently not persisted in canonical location.**  
   Middleware captures `context.user_agent`, but `D1EventLogsSink` serializes only `event.metadata` in `data_json`/`metadata`; `user_agent` is not guaranteed in metadata. Log Explorer normalization expects `metadata.user_agent` in many fallbacks.

3. **REVIEW-006-003 (P2): storefront log path lacks centralized redaction.**  
   `writeEventLog()` serializes arbitrary `data`/`metadata` without key-based redaction helper parity with other writers.

---

## D. Observability and Operations

### D1. Logging Mechanics (what gets logged)

1. **Middleware auto logs (`withLogging`)**  
   Emits one request log with: `level`, `action`, `message`, `correlation_id`, `request_id`, `route`, `method`, `status`, `duration_ms`, `ip`, `user_agent`, user fields, plus `metadata.request_json` and `metadata.response_json`.

2. **Sampling behavior**  
   Success/info logs are sampled (`LOG_SAMPLE_RATE_INFO`, default `0.2`), while warn/error are always logged; slow requests above threshold are always logged. This is the main reason “some routes don’t log” on successful responses.

3. **Manual logs (`logEvent` / `writeEventLog` / `logPlacesEvent`)**  
   Route-specific logs add richer domain context, but payload shape varies by helper.

### D2. Route Coverage

#### API Worker (`olive_and_ivory_api`)

- Registered routes scanned: **134**.
- Baseline coverage: **all routes behind global middleware** (`withRequestContext` + `withLogging` in `src/index.ts`).
- Effective behavior: all warnings/errors logged, successful requests only partially logged due to sampling.
- Additional explicit logs exist on selected flows (`places.*`, Stripe webhook/test, log-test, selected core routes), but not uniformly on every route.
- **Not logged at baseline:** none (middleware is global).  
  **Not consistently logged on success:** all routes subject to sampling.

#### Admin App (`admin_olive_and_ivory_gifts`)

- API route files scanned: **70**.
- Routes with `withApiLogging` and/or direct `logEvent`: **69**.
- Route without logging wrapper/manual log:
  - `admin_olive_and_ivory_gifts/src/app/api/admin/newsletter/route.ts`

#### Storefront App (`olive_and_ivory_gifts`)

- API route files scanned: **16**.
- Routes with explicit `writeEventLog` or `logEvent`: **2** route files (`/api/checkout/create`, `/api/browse/items`).
- Additional Places routes use `logPlacesEvent` helper (instrumented via a separate path).
- Route files with no explicit local event log writes:
  - `/api/delivery-options`
  - `/api/delivery/quote`
  - `/api/diagnostics/collections/slug/[slug]`
  - `/api/faqs`
  - `/api/geocode`
  - `/api/health`
  - `/api/newsletter`
  - `/api/orders`
  - `/api/orders/[id]`
  - `/api/orders/[id]/notify-delivery`
  - `/api/payments/stripe/webhook`
  - `/api/places/autocomplete`
  - `/api/places/details`
  - `/api/stripe/webhook`

Notes:
- Places routes are instrumented through `logPlacesEvent` (despite not using `writeEventLog`).
- Some instrumented routes only log selective branches (for example error-only in parts of browse/order proxy paths).

### D3. API Usage Coverage (Admin + Main Site -> API Worker)

#### Admin API routes calling API worker

- Route files under `admin_olive_and_ivory_gifts/src/app/api` scanned: **70**
- Route files directly using `proxySigned` and/or `signedApiFetch`: **30**
- Major proxied domains:
  - collections (`/api/collections*`, `/api/collections-with-gifts`, schema, reorder, gifts under collections)
  - gifts (`/api/gifts*`, media, AI runs, by-slug, bulk-update path support)
  - orders (`/api/orders*`, refund, status)
  - AI/admin actions (`/api/admin/*/ai-suggest`, `/api/admin/items/ai-suggest`)
  - observability (`/logs`, `/logs/:id`, `/api/metrics/logs`)
- Additional indirect API-worker checks run from admin system-health helpers via `admin_olive_and_ivory_gifts/src/lib/systemHealth.ts`.

#### Main site API routes calling API worker

- Route files under `olive_and_ivory_gifts/src/app/api` scanned: **16**
- Route files with direct API-worker usage: **8**
  - `/api/checkout/create` -> `/api/orders`
  - `/api/delivery-options` -> `/api/delivery-options`
  - `/api/delivery/quote` -> `/api/delivery/quote`
  - `/api/orders` -> `/api/orders`
  - `/api/orders/[id]` -> `/api/orders/:id`
  - `/api/stripe/webhook` -> `/api/stripe/webhook`
  - `/api/payments/stripe/webhook` -> `/api/stripe/webhook`
  - `/api/geocode` -> `/shipping/autocomplete` (worker route, non `/api/*` prefix)
- Indirect API-worker usage:
  - `/api/orders/[id]/notify-delivery` calls `getOrderById()` in `src/lib/orders.ts`, which uses signed fetch to `/api/orders/:id`.
- Non-worker external call:
  - `/api/newsletter` posts directly to `https://api.oliveandivorygifts.com/v1/newsletter/subscribe`.

#### Main site routes not using API worker (local DB/external provider/local health)

- `/api/browse/items` (local D1 + event logging helper)
- `/api/faqs` (local D1)
- `/api/diagnostics/collections/slug/[slug]` (local D1 diagnostics)
- `/api/health` (local runtime metadata)
- `/api/places/autocomplete` (Google Places direct + local event log helper)
- `/api/places/details` (Google Places direct + local event log helper)

### D4. Field Completeness (what is missing and why)

| Field | Expected | Actual | Gap |
|------|----------|--------|-----|
| `ip_address` | set for all externally sourced calls | often null or proxy-origin for server->worker proxy flows | forwarding headers not propagated in generic `signedApiFetch` |
| `user_agent` | available in detail payload | frequently null in Log Explorer | middleware captures UA but sink/payload conventions do not consistently persist it where normalizers expect |
| `request/response payload` | uniform structure | mixed (`data_json` canonical vs metadata blobs vs legacy) | four writer implementations with different canonical rules |
| route success logs | consistent visibility | partial visibility | `info` sampling default 20% |

### D5. Why Log Explorer Normalization Is Complex

Both API and admin log endpoints perform compatibility normalization to handle:

- legacy rows (older schema/columns),
- canonical payload rows (`data_json` with `http/request/response/meta`),
- metadata-only rows,
- AI run union rows that are not native `event_logs`.

This is functional but indicates ingestion is not yet standardized.

### D6. Failure Scenarios

1. Logging insert failure: request still succeeds (intended fail-safe), but observability blind spot occurs.
2. Schema drift across environments: fallback insert/select code paths produce inconsistent row shapes.
3. High-volume success traffic: sampling can hide route-level success diagnostics during debugging.

---

## E. Full Logging Documentation (current state)

### E1. Writers and Their Output Contracts

1. `withLogging` + `D1EventLogsSink` (shared middleware)
- best for automatic HTTP envelope logging
- writes first-class columns + `metadata`/`data_json` from `event.metadata`
- does not guarantee `user_agent` in serialized metadata payload

2. API/Admin `logEvent`
- canonical payload builder (`http`, `request`, `response`, `meta`, optional `extra`)
- strongest shape standardization today

3. Storefront `writeEventLog`
- simple INSERT wrapper
- flexible but not canonicalized to same schema shape

4. Storefront `logPlacesEvent`
- writes `metadata` JSON into both `data_json` and `metadata`
- useful for Places route telemetry but diverges from canonical payload structure

### E2. Current “Table View vs Detail View” Quality

- Table-level columns (`created_at`, `action`, `level`, `status_code`, `path`, `duration_ms`) are mostly available.
- Detail payload richness depends on writer used; canonical detail is strongest for API/Admin `logEvent` rows.
- IP and user-agent are inconsistent enough to hinder forensic filtering.

---

## F. 500 LOC Assessment

**Primary file LOC:** 263  
**Violation:** No

---

## G. Recommendations (No Code Changes Applied)

1. **Adopt one canonical log payload schema for all writers (P1).**  
   Every writer should emit `data_json` with `{ request_id, correlation_id, time, level, source, action, message, http, request, response, meta, extra }`.

2. **Stop relying on metadata fallback for `user_agent` (P1).**  
   Either add a dedicated `user_agent` column or enforce canonical `data_json.http.user_agent` population at writer level.

3. **Forward client provenance headers in server-to-worker proxies (P1).**  
   Include trusted forwarded headers (or explicit provenance fields) in signed fetches so API logs preserve true client IP chain.

4. **Define logging policy by route class (P2).**  
   `public critical` routes (checkout, webhooks, orders, auth, admin mutations) should be unsampled or separately sampled at much higher rate.

5. **Standardize route wrappers (P2).**  
   Admin routes should all use `withApiLogging`; storefront should have an equivalent shared wrapper to avoid route-by-route drift.

6. **Unify normalization ownership (P3).**  
   Move toward single normalization stage (preferably API side), with admin proxy as a thin pass-through.

---

## H. Definition of Done — This Review

- [x] Full logging pipeline documented
- [x] Logged routes identified
- [x] Not-logged/partially-logged routes identified
- [x] IP/user-agent field integrity gaps identified
- [x] Standardization recommendations documented
- [x] No runtime code changes applied

---

## I. Post-Review Quick Fixes Applied (2026-03-05)

These were implemented after the review write-up as low-risk remediations:

1. `signedApiFetch` in both admin and storefront now forwards client provenance headers (`cf-connecting-ip`, `x-forwarded-for`, `user-agent`) when request headers are available.
2. Admin/storefront proxy routes now pass incoming request headers to `signedApiFetch` so API-worker logs can preserve original client context more consistently.
3. Storefront geocode -> worker autocomplete proxy now forwards the same provenance headers.

Impact:
- Addresses the core part of **REVIEW-006-001** (IP provenance degradation on proxied calls).
- Improves downstream log quality for IP and user-agent fields in Log Explorer.
