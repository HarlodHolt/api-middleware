import { MiddlewareFn, HandlerFn, MiddlewareContext } from "../types";
import { runPipeline } from "../pipeline";

export function withNextJsPipeline<TContext = unknown>(
  middlewares: MiddlewareFn[],
  handler: (req: any, appCtx: TContext, mwCtx: MiddlewareContext) => Promise<Response> | Response
) {
  return async (req: any, appCtx: TContext) => {
    // NextRequest is technically a web Request, but edge/node boundaries exist.
    // The core middlewares use standard Request, which NextRequest implements.
    
    // We attempt to construct the cloudflare environment from process.env or Next context
    let env: Record<string, any> = {};
    try {
        // if next-on-pages is present and env is populated
        const { getRequestContext } = require("@cloudflare/next-on-pages");
        const nextCtx = getRequestContext();
        if (nextCtx && nextCtx.env) {
           env = nextCtx.env;
        }
    } catch {}

    // Fallback if local Next.js node server
    if (Object.keys(env).length === 0 && typeof process !== "undefined" && process.env) {
      env = process.env;
    }

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

    const finalHandler: HandlerFn = (r, c) => handler(r, appCtx, c);

    const response = await runPipeline(req as Request, ctx, middlewares, finalHandler);

    // Apply correlation headers
    if (ctx.correlation_id) response.headers.set("x-correlation-id", ctx.correlation_id);
    if (ctx.request_id) response.headers.set("x-request-id", ctx.request_id);

    return response;
  };
}
