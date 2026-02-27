import { Hono } from "hono";
import { hono, withErrorHandling, withLogging, withRequestContext } from "../../src/index";

const app = new Hono();

app.use("*", hono([withRequestContext(), withLogging({ action_prefix: "example.hono" }), withErrorHandling()]));

app.get("/hello", (context) => {
  return context.json({ ok: true, hello: "hono" });
});

export default app;
