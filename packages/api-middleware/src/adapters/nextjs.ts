import { MiddlewareFn, HandlerFn, MiddlewareContext } from "../types";
import { runPipeline } from "../pipeline";

async function resolveNextEnv(): Promise<Record<string, unknown>> {
  try {
    const dynamicImport = new Function("modulePath", "return import(modulePath);") as (modulePath: string) => Promise<unknown>;
    const module = await dynamicImport("@cloudflare/next-on-pages");
    const getRequestContext = (module as { getRequestContext?: () => { env?: Record<string, unknown> } | null }).getRequestContext;
    const ctx = getRequestContext?.();
    if (ctx?.env) {
      return ctx.env;
    }
  } catch {
    // no-op; local Next server or package not installed
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env as Record<string, unknown>;
  }
  return {};
}

export function withNextJsPipeline<TContext = unknown>(
  middlewares: MiddlewareFn[],
  handler: (req: any, appCtx: TContext, mwCtx: MiddlewareContext) => Promise<Response> | Response
) {
  return async (req: any, appCtx: TContext) => {
    const env = await resolveNextEnv();

    const ctx: MiddlewareContext = {
      correlation_id: "", // Will be set by withRequestContext
      start_ms: Date.now(),
      ip: null,
      user_agent: null,
      route: "",
      method: "",
      env,
      state: {},
    };

    const finalHandler: HandlerFn = (r, c) => {
      (r as unknown as Record<string, unknown>).__api_middleware_context = c;
      return handler(r, appCtx, c);
    };

    const response = await runPipeline(req as Request, ctx, middlewares, finalHandler);

    // Apply correlation headers
    if (ctx.correlation_id) response.headers.set("x-correlation-id", ctx.correlation_id);
    if (ctx.request_id) response.headers.set("x-request-id", ctx.request_id);

    return response;
  };
}
