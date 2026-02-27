import { MiddlewareFn, MiddlewareContext } from "../types";
import { runPipeline } from "../pipeline";
import { resolveRequestIds } from "../request-context";

export function withHonoPipeline(middlewares: MiddlewareFn[]) {
  return async (c: any, next: any) => {
    const ids = resolveRequestIds(c.req.raw.headers);
    // Populate normalized MW context
    const ctx: MiddlewareContext = {
      correlation_id: c.get("correlation_id") || c.get("correlationId") || ids.correlationId,
      request_id: c.get("requestId") || ids.requestId,
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
    if (pipelineResponse) {
      if (ctx.correlation_id) pipelineResponse.headers.set("x-correlation-id", ctx.correlation_id);
      if (ctx.request_id) pipelineResponse.headers.set("x-request-id", ctx.request_id);
    }

    if (pipelineResponse && pipelineResponse !== c.res) {
       c.res = pipelineResponse;
    }
  };
}
