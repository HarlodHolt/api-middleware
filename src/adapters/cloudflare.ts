import { MiddlewareFn, HandlerFn, MiddlewareContext } from "../types";
import { runPipeline } from "../pipeline";

export function withCloudflarePipeline<Env = any>(
  middlewares: MiddlewareFn[],
  handler: (req: Request, env: Env, mwCtx: MiddlewareContext) => Promise<Response> | Response
) {
  // Cloudflare export default { fetch(req, env, ctx) ... } or Pages (context)
  return async (req: Request, env: any, extCtx?: any) => {
    const ctx: MiddlewareContext = {
      correlation_id: "", 
      start_ms: Date.now(),
      ip: null,
      user_agent: null,
      route: "",
      method: "",
      env,
      state: {},
    };

    const finalHandler: HandlerFn = (r, c) => handler(r, env, c);

    const response = await runPipeline(req, ctx, middlewares, finalHandler);

    // Apply correlation headers
    if (ctx.correlation_id) response.headers.set("x-correlation-id", ctx.correlation_id);
    if (ctx.request_id) response.headers.set("x-request-id", ctx.request_id);

    return response;
  };
}
