import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyError,
  createHmacSignature,
  getHeaderCaseInsensitive,
  getRetryAfterSeconds,
  getWindowStartSeconds,
  resolveRequestIds,
  withRateLimit,
  verifyHmacSignature,
} from "../src/index";

test("resolveRequestIds prefers x-correlation-id and falls back to cf-ray", () => {
  const headers = new Headers({
    "X-Correlation-Id": "corr-1",
    "CF-Ray": "ray-1",
  });
  const ids = resolveRequestIds(headers, () => "generated");
  assert.equal(ids.correlationId, "corr-1");
  assert.equal(ids.requestId, "ray-1");
  assert.equal(getHeaderCaseInsensitive(headers, "x-correlation-id"), "corr-1");
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
  assert.equal(await verifyHmacSignature({ secret, payload: `${payload}-x`, signature }), false);
});

test("rate limit window helpers return stable bucket and retry-after", () => {
  const nowMs = 1710000123456;
  const windowSeconds = 60;
  const windowStart = getWindowStartSeconds(nowMs, windowSeconds);
  assert.equal(windowStart, 1710000120);
  const retry = getRetryAfterSeconds(nowMs, windowStart, windowSeconds);
  assert.ok(retry >= 1 && retry <= windowSeconds);
});

test("withRateLimit returns 429 with retry-after header", async () => {
  const counters = new Map<string, number>();
  const db = {
    prepare(sql: string) {
      let bound: Array<unknown> = [];
      return {
        bind(...values: Array<unknown>) {
          bound = values;
          return this;
        },
        async run() {
          if (sql.includes("INSERT INTO api_rate_limits")) {
            const key = `${String(bound[0])}:${String(bound[1])}`;
            counters.set(key, (counters.get(key) || 0) + 1);
          }
          return {};
        },
        async first() {
          const key = `${String(bound[0])}:${String(bound[1])}`;
          return { request_count: counters.get(key) || 0 };
        },
      };
    },
  };

  const middleware = withRateLimit({
    limit: 1,
    windowSeconds: 60,
    keyFn: () => "ip-test",
  });
  const req = new Request("https://example.com/api/test");
  const ctx = {
    correlation_id: "corr-1",
    start_ms: Date.now(),
    ip: "1.1.1.1",
    user_agent: null,
    route: "/api/test",
    method: "GET",
    env: { DB: db },
    state: {},
  };

  const first = await middleware(req, ctx, async () => new Response("ok"));
  assert.equal(first.status, 200);
  const second = await middleware(req, ctx, async () => new Response("ok"));
  assert.equal(second.status, 429);
  assert.ok(second.headers.get("Retry-After"));
});
