import { MiddlewareFn, HandlerFn, MiddlewareContext } from "./types";

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
    if (i === middlewares.length) {
      return await finalHandler(req, ctx);
    }
    const mw = middlewares[i];
    return await mw(req, ctx, () => dispatch(i + 1));
  }

  return dispatch(0);
}
