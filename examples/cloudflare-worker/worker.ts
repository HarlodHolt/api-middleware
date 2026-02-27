import { cloudflare, withErrorHandling, withLogging, withRequestContext } from "../../src/index";

export default {
  fetch: cloudflare(
    [withRequestContext(), withLogging({ action_prefix: "example.cloudflare" }), withErrorHandling()],
    async (_request, _env, middlewareContext) => {
      return Response.json({ ok: true, hello: "cloudflare", request_id: middlewareContext.request_id });
    },
  ),
};
