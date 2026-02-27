import { nextjs, withErrorHandling, withJsonBody, withLogging, withRequestContext } from "../../src/index";

export const POST = nextjs(
  [withRequestContext(), withJsonBody(), withLogging({ action_prefix: "example.nextjs" }), withErrorHandling()],
  async (_request, _appContext, middlewareContext) => {
    return Response.json({ ok: true, hello: "nextjs", correlation_id: middlewareContext.correlation_id });
  },
);
