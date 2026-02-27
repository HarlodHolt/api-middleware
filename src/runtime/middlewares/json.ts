import { jsonError } from "../helpers";
import type { MiddlewareFunction } from "../types";

export function withJsonBody(limitBytes = 16 * 1024, allowEmpty = true): MiddlewareFunction {
  return async (request, context, next) => {
    if (request.method === "GET" || request.method === "HEAD") {
      context.state.parsed_body = {};
      return next();
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      context.state.parsed_body = {};
      return next();
    }

    const bodyText = await request.clone().text();
    if (!bodyText) {
      if (!allowEmpty) {
        return jsonError(
          {
            status: 400,
            code: "bad_request",
            message: "Empty JSON body",
          },
          context,
        );
      }

      context.state.parsed_body = {};
      return next();
    }

    const bodySize = new TextEncoder().encode(bodyText).length;
    if (bodySize > limitBytes) {
      return jsonError(
        {
          status: 413,
          code: "payload_too_large",
          message: `Payload exceeds limit of ${limitBytes} bytes`,
        },
        context,
      );
    }

    try {
      context.state.parsed_body = JSON.parse(bodyText) as unknown;
    } catch {
      return jsonError(
        {
          status: 400,
          code: "bad_request",
          message: "Invalid JSON body",
        },
        context,
      );
    }

    return next();
  };
}
