import { classifyError } from "../classify-error";
import { jsonError } from "../helpers";
import type { MiddlewareFunction } from "../types";

export function withErrorHandling(): MiddlewareFunction {
  return async (_request, context, next) => {
    try {
      return await next();
    } catch (error) {
      const classifiedError = classifyError(error);
      context.state.unhandled_error = error;
      return jsonError(
        {
          status: classifiedError.status,
          code: classifiedError.code,
          message: classifiedError.message,
          details: classifiedError.details,
          headers: classifiedError.headers,
        },
        context,
      );
    }
  };
}
