import { MiddlewareFn } from "../types";
import { jsonError } from "../helpers";

export function withErrorHandling(): MiddlewareFn {
  return async (req, ctx, next) => {
    try {
      return await next();
    } catch (error) {
      console.error("Caught in ErrorHandling MW:", error);
      
      const raw = error instanceof Error ? error.message : String(error || "Unknown error");
      const lowered = raw.toLowerCase();
      
      let status = 500;
      let code = "server_error";
      let message = "Internal server error";

      if (lowered.includes("d1_error") || lowered.includes("sqlite_error")) {
        if (lowered.includes("constraint")) {
          status = 409;
          code = "constraint_error";
          message = "Request conflicts with existing data.";
        } else if (lowered.includes("no such table") || lowered.includes("no such column")) {
          status = 500;
          code = "schema_mismatch";
          message = "Database schema is out of date.";
        } else {
          status = 500;
          code = "database_error";
          message = "Database request failed.";
        }
      }

      ctx.state.unhandledError = error;

      return jsonError({
        status,
        code,
        message,
        correlation_id: ctx.correlation_id,
        details: error instanceof Error ? { name: error.name, message: error.message } : undefined
      });
    }
  };
}
