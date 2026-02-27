import { MiddlewareFn } from "../types";
import { getHeaderCaseInsensitive, resolveRequestIds } from "../request-context";

export function withRequestContext(): MiddlewareFn {
  return async (req, ctx, next) => {
    const url = new URL(req.url);
    const ids = resolveRequestIds(req.headers);

    let ip = getHeaderCaseInsensitive(req.headers, "cf-connecting-ip");
    if (!ip) {
      const forwarded = getHeaderCaseInsensitive(req.headers, "x-forwarded-for");
      if (forwarded) ip = forwarded.split(",")[0]?.trim();
    }

    ctx.correlation_id = ids.correlationId;
    ctx.request_id = ids.requestId;
    ctx.start_ms = Date.now();
    ctx.ip = ip || null;
    ctx.user_agent = getHeaderCaseInsensitive(req.headers, "user-agent") || null;
    ctx.route = url.pathname;
    ctx.method = req.method;

    const userEmail = getHeaderCaseInsensitive(req.headers, "cf-access-authenticated-user-email");
    const userId = getHeaderCaseInsensitive(req.headers, "cf-access-authenticated-user-id");

    ctx.user_id = userId || null;
    ctx.user_email = userEmail || null;
    if (!ctx.state) ctx.state = {};

    return next();
  };
}

export function withEnvValidation(requiredKeys: string[]): MiddlewareFn {
  return async (req, ctx, next) => {
    const missing = requiredKeys.filter((key) => !ctx.env[key]);
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "misconfiguration",
            message: `Server missing required env bindings: ${missing.join(", ")}`,
            correlation_id: ctx.correlation_id
          }
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    return next();
  };
}

export function withCors(options?: { allowOrigin?: string; allowMethods?: string[] }): MiddlewareFn {
  return async (req, ctx, next) => {
    if (req.method === "OPTIONS") {
      const origin = options?.allowOrigin || "*";
      const methods = options?.allowMethods?.join(", ") || "GET, HEAD, POST, OPTIONS, PUT, DELETE";
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": methods,
          "Access-Control-Allow-Headers": "Content-Type, x-oi-timestamp, x-oi-nonce, x-oi-signature, x-correlation-id, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    const response = await next();
    const origin = options?.allowOrigin || "*";
    response.headers.set("Access-Control-Allow-Origin", origin);
    return response;
  };
}
