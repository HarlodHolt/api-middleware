import { MiddlewareFn } from "../types";

export function withRequestContext(): MiddlewareFn {
  return async (req, ctx, next) => {
    const url = new URL(req.url);
    const correlationId =
      req.headers.get("x-correlation-id") ||
      req.headers.get("correlation-id") ||
      crypto.randomUUID();

    const requestId =
      req.headers.get("cf-ray") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID();

    let ip = req.headers.get("cf-connecting-ip");
    if (!ip) {
      const forwarded = req.headers.get("x-forwarded-for");
      if (forwarded) ip = forwarded.split(",")[0]?.trim();
    }

    ctx.correlation_id = correlationId;
    ctx.request_id = requestId;
    ctx.start_ms = Date.now();
    ctx.ip = ip || null;
    ctx.user_agent = req.headers.get("user-agent") || null;
    ctx.route = url.pathname;
    ctx.method = req.method;

    const userEmail =
      req.headers.get("cf-access-authenticated-user-email") ||
      req.headers.get("Cf-Access-Authenticated-User-Email");
    const userId =
      req.headers.get("cf-access-authenticated-user-id") ||
      req.headers.get("Cf-Access-Authenticated-User-Id");

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
