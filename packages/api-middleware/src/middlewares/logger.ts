import { OBSERVABILITY_ACTIONS, ObservabilityAction } from "../actions";
import { MiddlewareFn } from "../types";

const SENSITIVE_KEYS = [
  "authorization", "cookie", "set-cookie", "openai_api_key",
  "api_key", "token", "password", "stripe_secret_key",
  "google_places_api_key", "hmac_shared_secret",
];

export function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.some((item) => k.toLowerCase().includes(item))) {
      out[k] = "[REDACTED]";
      continue;
    }
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message, stack: v.stack };
      continue;
    }
    out[k] = redact(v);
  }
  return out;
}

export function safeJsonStringify(value: unknown, maxBytes = 16384): string {
  const text = JSON.stringify(redact(value ?? {}));
  if (!text) return "{}";
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= maxBytes) return text;
  const head = text.slice(0, Math.max(0, maxBytes - 120));
  return JSON.stringify({ __truncated__: true, preview: head });
}

function parseSampleRate(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function parseNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function hashRequestIdToUnitInterval(requestId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < requestId.length; index += 1) {
    hash ^= requestId.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return normalized;
}

function getActionForHttpLog(statusCode: number, hadUnhandledError: boolean): ObservabilityAction {
  if (hadUnhandledError || statusCode >= 500) {
    return OBSERVABILITY_ACTIONS.HTTP_ERROR;
  }
  return OBSERVABILITY_ACTIONS.HTTP_RESPONSE;
}

export function withLogging(opts?: { actionPrefix?: string }): MiddlewareFn {
  return async (req, ctx, next) => {
    const startedAt = Date.now();
    let response: Response | null = null;
    let caughtError: unknown = null;
    try {
      response = await next();
      return response;
    } catch (error) {
      caughtError = error;
      throw error;
    } finally {
      if (ctx.state.__logged_once) {
        // already logged by another middleware layer
      } else {
        ctx.state.__logged_once = true;
        const durationMs = Date.now() - startedAt;
        const statusCode = response?.status ?? 500;

        let responsePayload: unknown = null;
        if (response) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            try {
              const cloned = response.clone();
              responsePayload = await cloned.json().catch(() => null);
            } catch {
              responsePayload = null;
            }
          }
        }

        let requestPayload: unknown = null;
        const parsedBody = ctx.state?.parsedBody;
        if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
          requestPayload = {
            __body_logged__: false,
            key_count: Object.keys(parsedBody as Record<string, unknown>).length,
          };
        }

        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
        const source = "api";
        const action = getActionForHttpLog(statusCode, Boolean(caughtError));
        const logSampleRateInfo = parseSampleRate(ctx.env.LOG_SAMPLE_RATE_INFO, 0.2);
        const logSampleRateDebug = parseSampleRate(ctx.env.LOG_SAMPLE_RATE_DEBUG, 0);
        const logAlwaysSlowMs = parseNumber(ctx.env.LOG_ALWAYS_LOG_SLOW_MS, 1500);
        const normalizedRequestId = String(ctx.request_id || ctx.correlation_id || "missing-request-id");
        const requestHash = hashRequestIdToUnitInterval(normalizedRequestId);
        const isSlowRequest = durationMs >= logAlwaysSlowMs;
        const mustLogLevel = level === "warn" || level === "error";
        const levelSampleRate = logSampleRateInfo;
        const isSampledIn = requestHash <= levelSampleRate;
        const shouldLogRequest = mustLogLevel || isSlowRequest || isSampledIn;

        if (shouldLogRequest) {
          const payload = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          level,
          source,
          action,
          correlation_id: ctx.correlation_id,
          user_email: ctx.user_email || null,
          user_id: ctx.user_id || null,
          message: `${ctx.method} ${ctx.route} -> ${statusCode}`,
          request_id: ctx.request_id || null,
          event_type: "http",
          ip_address: ctx.ip || null,
          duration_ms: durationMs,
          method: ctx.method,
          path: ctx.route,
          status_code: statusCode,
          entity_type: null,
          entity_id: null,
          metadata: safeJsonStringify({
              query: Object.fromEntries(new URL(req.url).searchParams.entries()),
              user_agent: ctx.user_agent,
              request_json: requestPayload,
              response_json: responsePayload,
              action_prefix: opts?.actionPrefix || null,
              sampling: {
                sampled_in: isSampledIn,
                sample_rate_info: logSampleRateInfo,
                sample_rate_debug: logSampleRateDebug,
                request_hash: requestHash,
                slow_request: isSlowRequest,
                slow_threshold_ms: logAlwaysSlowMs,
              },
          }),
          data_json: safeJsonStringify({
              error: caughtError ? String(caughtError) : undefined,
          })
          };

          if (ctx.env.DB) {
            ctx.env.DB.prepare(
              `INSERT INTO event_logs
               (id, created_at, level, source, action, correlation_id, user_email, user_id, entity_type, entity_id, message, data_json, request_id, event_type, ip_address, duration_ms, method, path, status_code, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(
                  payload.id, payload.created_at, payload.level, payload.source, payload.action, payload.correlation_id,
                  payload.user_email, payload.user_id, payload.entity_type, payload.entity_id, payload.message,
                  payload.data_json, payload.request_id, payload.event_type, payload.ip_address, payload.duration_ms,
                  payload.method, payload.path, payload.status_code, payload.metadata
              )
              .run()
              .catch((error: Error) => {
                const safeErrorCode =
                  error.message?.toLowerCase().includes("constraint") ? "constraint_error" :
                  error.message?.toLowerCase().includes("no such table") ? "schema_mismatch" :
                  "log_sink_failed";
                console.warn("[withLogging] non-fatal log sink failure", {
                  correlation_id: ctx.correlation_id,
                  code: safeErrorCode,
                  message: error.message,
                });
              });
          } else {
            console.log(JSON.stringify(payload));
          }
        }
      }
    }
  };
}
