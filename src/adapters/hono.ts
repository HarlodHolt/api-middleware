import { MiddlewareFn, MiddlewareContext } from "../types";
import { runPipeline } from "../pipeline";

export function withHonoPipeline(middlewares: MiddlewareFn[]) {
  return async (c: any, next: any) => {
    // Populate normalized MW context
    const ctx: MiddlewareContext = {
      correlation_id: c.get("correlation_id") || c.get("correlationId") || crypto.randomUUID(),
      request_id: c.get("requestId") || c.req.header("cf-ray") || crypto.randomUUID(),
      start_ms: Date.now(),
      ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null,
      user_agent: c.req.header("user-agent") || null,
      route: new URL(c.req.url).pathname,
      method: c.req.method,
      user_email: c.get("user_email") || c.req.header("cf-access-authenticated-user-email") || null,
      user_id: c.get("user_id") || c.req.header("cf-access-authenticated-user-id") || null,
      env: c.env || {},
      state: {},
    };

    const finalHandler = async () => {
       c.set("correlation_id", ctx.correlation_id);
       c.set("correlationId", ctx.correlation_id);
       c.set("requestId", ctx.request_id);
       if (ctx.state) c.set("mwState", ctx.state);
       
       await next();
       return c.res;
    };

    const pipelineResponse = await runPipeline(c.req.raw, ctx, middlewares, finalHandler);

    if (pipelineResponse && pipelineResponse !== c.res) {
       c.res = pipelineResponse;
    }
  };
}
