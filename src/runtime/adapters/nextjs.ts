import { attachRequestHeaders } from "../helpers";
import { runPipeline } from "../pipeline";
import type { HandlerFunction, MiddlewareContext, MiddlewareFunction } from "../types";

async function resolveNextEdgeEnv(): Promise<Record<string, unknown>> {
  try {
    const dynamicImport = new Function("modulePath", "return import(modulePath);") as (
      modulePath: string,
    ) => Promise<{ getRequestContext?: () => { env?: Record<string, unknown> } | null }>;

    const module = await dynamicImport("@cloudflare/next-on-pages");
    const requestContext = module.getRequestContext?.();
    if (requestContext?.env) {
      return requestContext.env;
    }
  } catch {
    // Ignore when package is unavailable in local development.
  }

  return {};
}

export function nextjs(
  middlewares: MiddlewareFunction[],
  handler: (
    request: Request,
    appContext: unknown,
    middlewareContext: MiddlewareContext,
  ) => Promise<Response> | Response,
) {
  return async (request: Request, appContext: unknown): Promise<Response> => {
    const env = await resolveNextEdgeEnv();
    const middlewareContext: MiddlewareContext = {
      correlation_id: "",
      request_id: "",
      start_ms: Date.now(),
      ip: null,
      user_agent: null,
      route: "",
      method: "",
      env,
      state: {},
    };

    const finalHandler: HandlerFunction = (finalRequest, finalContext) => {
      return handler(finalRequest, appContext, finalContext);
    };

    const response = await runPipeline(request, middlewareContext, middlewares, finalHandler);
    return attachRequestHeaders(response, middlewareContext);
  };
}

export const withNextJsPipeline = nextjs;
