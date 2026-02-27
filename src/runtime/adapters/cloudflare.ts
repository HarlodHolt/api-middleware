import { attachRequestHeaders } from "../helpers";
import { runPipeline } from "../pipeline";
import type { HandlerFunction, MiddlewareContext, MiddlewareFunction, WorkerExecutionContext } from "../types";

export function cloudflare<Env = unknown>(
  middlewares: MiddlewareFunction[],
  handler: (
    request: Request,
    env: Env,
    middlewareContext: MiddlewareContext,
    executionContext?: WorkerExecutionContext,
  ) => Promise<Response> | Response,
) {
  return async (request: Request, env: Env, executionContext?: WorkerExecutionContext): Promise<Response> => {
    const middlewareContext: MiddlewareContext = {
      correlation_id: "",
      request_id: "",
      start_ms: Date.now(),
      ip: null,
      user_agent: null,
      route: "",
      method: "",
      env: (env as Record<string, unknown>) || {},
      state: {},
    };

    const finalHandler: HandlerFunction = (finalRequest, finalContext) => {
      return handler(finalRequest, env, finalContext, executionContext);
    };

    const response = await runPipeline(request, middlewareContext, middlewares, finalHandler);
    return attachRequestHeaders(response, middlewareContext);
  };
}

export const withCloudflarePipeline = cloudflare;
