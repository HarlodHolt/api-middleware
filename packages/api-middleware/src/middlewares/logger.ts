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

export function withLogging(opts?: { actionPrefix?: string }): MiddlewareFn {
  return async (req, ctx, next) => {
    const startedAt = Date.now();
    
    // We expect body parsing might happen in a downstream middleware (withJsonBody)
    const requestPayload = ctx.state?.parsedBody || null; 

    const response = await next();
    const durationMs = Date.now() - startedAt;
    
    // Try to parse response payload if json (just a peek)
    let responsePayload: unknown = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
       try {
           const cloned = response.clone();
           responsePayload = await cloned.json().catch(() => null);
       } catch {}
    }

    const statusCode = response.status || 200;
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    const source = "api";
    const action = opts?.actionPrefix || "http.request";

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
            request_json: ctx.state.parsedBody,
            response_json: responsePayload,
        }),
        data_json: safeJsonStringify({
            error: ctx.state.unhandledError ? String(ctx.state.unhandledError) : undefined,
        })
    };

    if (ctx.env.DB) {
        // Log to D1 async
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
            .catch((e: Error) => console.error("Logging to DB failed:", e.message));
    } else {
        console.log(JSON.stringify(payload));
    }

    return response;
  };
}
