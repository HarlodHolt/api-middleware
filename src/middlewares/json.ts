import { MiddlewareFn } from "../types";
import { jsonError } from "../helpers";

export function withJsonBody(limitBytes = 16 * 1024, allowEmpty = true): MiddlewareFn {
  return async (req, ctx, next) => {
    if (req.method === "GET" || req.method === "HEAD") {
      ctx.state.parsedBody = {};
      return next();
    }

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const cloned = req.clone();
      const text = await cloned.text();

      if (!text) {
        if (!allowEmpty) {
          return jsonError({ status: 400, code: "bad_request", message: "Empty JSON body", correlation_id: ctx.correlation_id });
        }
        ctx.state.parsedBody = {};
        return next();
      }

      if (new TextEncoder().encode(text).length > limitBytes) {
        return jsonError({ status: 413, code: "payload_too_large", message: `Payload exceeds limit of ${limitBytes} bytes`, correlation_id: ctx.correlation_id });
      }

      try {
         ctx.state.parsedBody = JSON.parse(text);
      } catch {
         return jsonError({ status: 400, code: "bad_request", message: "Invalid JSON body", correlation_id: ctx.correlation_id });
      }
    } else {
        ctx.state.parsedBody = {};
    }
    
    return next();
  };
}
