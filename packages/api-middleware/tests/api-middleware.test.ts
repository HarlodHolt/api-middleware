import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyError,
  createHmacSignature,
  getHeaderCaseInsensitive,
  getRetryAfterSeconds,
  getWindowStartSeconds,
  resolveRequestIds,
  verifyHmacSignature,
  withRateLimit,
} from "../src/index";

test("resolveRequestIds prefers x-correlation-id and falls back to cf-ray", () => {
  const request = new Request("https://example.com", {
    headers: {
      "X-Correlation-Id": "corr-1",
      "CF-Ray": "ray-1",
    },
  });

  const ids = resolveRequestIds(request, null, () => "generated-id");
  assert.equal(ids.correlation_id, "corr-1");
  assert.equal(ids.request_id, "ray-1");
  assert.equal(getHeaderCaseInsensitive(request.headers, "x-correlation-id"), "corr-1");
});

test("classifyError maps D1 unique constraint to 409", () => {
  const classified = classifyError(new Error("D1_ERROR: UNIQUE constraint failed: gifts.slug"));
  assert.equal(classified.status, 409);
  assert.equal(classified.code, "constraint_error");
});

test("HMAC verify succeeds for matching payload and fails otherwise", async () => {
  const secret = "test-secret";
  const payload = "POST\n/api/test\n1700000000\nnonce\nhash";
  const signature = await createHmacSignature(secret, payload);

  assert.equal(await verifyHmacSignature({ secret, payload, signature }), true);
  assert.equal(await verifyHmacSignature({ secret, payload: `${payload}-mismatch`, signature }), false);
});

test("rate limit window helpers return stable bucket and retry-after", () => {
  const nowMilliseconds = 1710000123456;
  const windowSeconds = 60;
  const windowStart = getWindowStartSeconds(nowMilliseconds, windowSeconds);
  assert.equal(windowStart, 1710000120);

  const retryAfter = getRetryAfterSeconds(nowMilliseconds, windowStart, windowSeconds);
  assert.ok(retryAfter >= 1 && retryAfter <= windowSeconds);
});

test("withRateLimit returns 429 with retry-after header in memory mode", async () => {
  const middleware = withRateLimit({
    limit: 1,
    window_seconds: 60,
    key_fn: () => "ip-test",
    mode: "memory",
  });

  const request = new Request("https://example.com/api/test");
  const context = {
    correlation_id: "corr-1",
    request_id: "req-1",
    start_ms: Date.now(),
    ip: "1.1.1.1",
    user_agent: null,
    route: "/api/test",
    method: "GET",
    env: {},
    state: {},
  };

  const firstResponse = await middleware(request, context, async () => new Response("ok"));
  assert.equal(firstResponse.status, 200);

  const secondResponse = await middleware(request, context, async () => new Response("ok"));
  assert.equal(secondResponse.status, 429);
  assert.ok(secondResponse.headers.get("retry-after"));
});
