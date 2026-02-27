import { jsonError } from "../helpers";
import { getHeaderCaseInsensitive, resolveRequestIds } from "../request-context";
import type { MiddlewareFunction } from "../types";

export function withRequestContext(): MiddlewareFunction {
  return async (request, context, next) => {
    const requestUrl = new URL(request.url);
    const requestIds = resolveRequestIds(request);

    const forwardedForHeader = getHeaderCaseInsensitive(request.headers, "x-forwarded-for");
    const ipAddress =
      getHeaderCaseInsensitive(request.headers, "cf-connecting-ip") ||
      forwardedForHeader?.split(",")[0]?.trim() ||
      null;

    context.correlation_id = requestIds.correlation_id;
    context.request_id = requestIds.request_id;
    context.start_ms = Date.now();
    context.ip = ipAddress;
    context.user_agent = getHeaderCaseInsensitive(request.headers, "user-agent") || null;
    context.route = requestUrl.pathname;
    context.method = request.method;
    context.user_email = getHeaderCaseInsensitive(request.headers, "cf-access-authenticated-user-email") || null;
    context.user_id = getHeaderCaseInsensitive(request.headers, "cf-access-authenticated-user-id") || null;

    if (!context.state) {
      context.state = {};
    }

    return next();
  };
}

export function withEnvValidation(requiredKeys: string[]): MiddlewareFunction {
  return async (_request, context, next) => {
    const missingKeys = requiredKeys.filter((key) => !context.env[key]);
    if (missingKeys.length > 0) {
      return jsonError(
        {
          status: 500,
          code: "misconfiguration",
          message: `Server missing required env bindings: ${missingKeys.join(", ")}`,
        },
        context,
      );
    }

    return next();
  };
}

export function withCors(options?: { allow_origin?: string; allow_methods?: string[] }): MiddlewareFunction {
  return async (request, context, next) => {
    const allowOrigin = options?.allow_origin || "*";
    const allowMethods = options?.allow_methods?.join(", ") || "GET, HEAD, POST, OPTIONS, PUT, DELETE";

    if (request.method === "OPTIONS") {
      const preflightResponse = new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": allowOrigin,
          "access-control-allow-methods": allowMethods,
          "access-control-allow-headers":
            "content-type, x-oi-timestamp, x-oi-nonce, x-oi-signature, x-correlation-id, authorization",
          "access-control-max-age": "86400",
          "x-correlation-id": context.correlation_id,
          "x-request-id": context.request_id,
        },
      });
      return preflightResponse;
    }

    const response = await next();
    response.headers.set("access-control-allow-origin", allowOrigin);
    return response;
  };
}
