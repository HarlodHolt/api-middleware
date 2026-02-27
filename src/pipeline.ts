import { MiddlewareFn, HandlerFn, MiddlewareContext } from "./types";
import { jsonError } from "./helpers";

export function compose(...middlewares: MiddlewareFn[]) {
  return middlewares;
}

export async function runPipeline(
  req: Request,
  ctx: MiddlewareContext,
  middlewares: MiddlewareFn[],
  finalHandler: HandlerFn
): Promise<Response> {
  let index = -1;

  async function dispatch(i: number): Promise<Response> {
    if (i <= index) throw new Error("next() called multiple times");
    index = i;
    try {
      if (i === middlewares.length) {
        return await finalHandler(req, ctx);
      }
      const mw = middlewares[i];
      return await mw(req, ctx, () => dispatch(i + 1));
    } catch (error) {
       console.error("Pipeline Error:", error);
       return jsonError({
          status: 500,
          code: "server_error",
          message: error instanceof Error ? error.message : "Internal server error",
          correlation_id: ctx.correlation_id,
       });
    }
  }

  return dispatch(0);
}
