import { MiddlewareFn } from "../types";
import { jsonError } from "../helpers";
import { classifyError } from "../classify-error";

export function withErrorHandling(): MiddlewareFn {
  return async (req, ctx, next) => {
    try {
      return await next();
    } catch (error) {
      const classified = classifyError(error);
      ctx.state.unhandledError = error;
      return jsonError({
        status: classified.status,
        code: classified.code,
        message: classified.message,
        correlation_id: ctx.correlation_id,
        details: classified.details,
      });
    }
  };
}
