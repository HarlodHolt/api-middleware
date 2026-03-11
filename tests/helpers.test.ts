import assert from "node:assert/strict";
import test from "node:test";

import { jsonOk, jsonError, noContent, redirect, attachRequestHeaders } from "../src/runtime/helpers";

test("jsonOk returns 200 with JSON body", async () => {
  const res = jsonOk({ items: [1, 2] });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json");
  const body = (await res.json()) as { items: number[] };
  assert.deepEqual(body.items, [1, 2]);
});

test("jsonOk accepts a custom status code", () => {
  const res = jsonOk({ created: true }, 201);
  assert.equal(res.status, 201);
});

test("jsonOk attaches request headers from context", () => {
  const res = jsonOk({ ok: true }, 200, { correlation_id: "c-1", request_id: "r-1" });
  assert.equal(res.headers.get("x-correlation-id"), "c-1");
  assert.equal(res.headers.get("x-request-id"), "r-1");
});

test("jsonError returns structured error body", async () => {
  const res = jsonError({ status: 422, code: "validation_error", message: "Bad input" });
  assert.equal(res.status, 422);
  const body = (await res.json()) as { ok: boolean; error: { code: string; message: string } };
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "validation_error");
  assert.equal(body.error.message, "Bad input");
});

test("jsonError merges custom headers", () => {
  const res = jsonError({
    status: 429,
    code: "rate_limited",
    message: "Too many requests",
    headers: { "retry-after": "30" },
  });
  assert.equal(res.headers.get("retry-after"), "30");
  assert.equal(res.headers.get("content-type"), "application/json");
});

test("jsonError uses correlation_id from error over context", async () => {
  const res = jsonError(
    { status: 500, code: "internal", message: "fail", correlation_id: "err-corr" },
    { correlation_id: "ctx-corr", request_id: "r-1" },
  );
  const body = (await res.json()) as { error: { correlation_id: string } };
  assert.equal(body.error.correlation_id, "err-corr");
  assert.equal(res.headers.get("x-correlation-id"), "err-corr");
  assert.equal(res.headers.get("x-request-id"), "r-1");
});

test("noContent returns 204 with no body", async () => {
  const res = noContent();
  assert.equal(res.status, 204);
  assert.equal(await res.text(), "");
});

test("redirect returns 302 with location header", () => {
  const res = redirect("https://example.com/done");
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "https://example.com/done");
});

test("redirect accepts custom status", () => {
  const res = redirect("https://example.com", 301);
  assert.equal(res.status, 301);
});

test("attachRequestHeaders is a no-op without context", () => {
  const res = new Response("ok");
  attachRequestHeaders(res);
  assert.equal(res.headers.get("x-correlation-id"), null);
  assert.equal(res.headers.get("x-request-id"), null);
});
