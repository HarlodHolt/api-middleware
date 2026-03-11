import assert from "node:assert/strict";
import test from "node:test";

import { redactSensitive, safeJsonStringify, truncateText } from "../src/runtime/logging";

// --- redactSensitive ---

test("redactSensitive redacts authorization header", () => {
  const result = redactSensitive({ authorization: "Bearer secret123" });
  assert.deepEqual(result, { authorization: "[REDACTED]" });
});

test("redactSensitive redacts nested sensitive keys", () => {
  const result = redactSensitive({
    config: { stripe_secret_key: "sk_live_xxx", name: "test" },
  }) as Record<string, unknown>;
  const config = result.config as Record<string, unknown>;
  assert.equal(config.stripe_secret_key, "[REDACTED]");
  assert.equal(config.name, "test");
});

test("redactSensitive handles arrays", () => {
  const result = redactSensitive([
    { password: "hunter2", user: "admin" },
    { token: "abc", role: "viewer" },
  ]) as Record<string, unknown>[];
  assert.equal(result[0].password, "[REDACTED]");
  assert.equal(result[0].user, "admin");
  assert.equal(result[1].token, "[REDACTED]");
  assert.equal(result[1].role, "viewer");
});

test("redactSensitive is case-insensitive on keys", () => {
  const result = redactSensitive({ HMAC_SHARED_SECRET: "s3cret", Cookie: "sess=abc" });
  assert.deepEqual(result, { HMAC_SHARED_SECRET: "[REDACTED]", Cookie: "[REDACTED]" });
});

test("redactSensitive passes through null, undefined, primitives", () => {
  assert.equal(redactSensitive(null), null);
  assert.equal(redactSensitive(undefined), undefined);
  assert.equal(redactSensitive("hello"), "hello");
  assert.equal(redactSensitive(42), 42);
});

// --- truncateText ---

test("truncateText returns short strings unchanged", () => {
  assert.equal(truncateText("hello", 10), "hello");
});

test("truncateText truncates with ellipsis", () => {
  const result = truncateText("abcdefghij", 8);
  assert.equal(result, "abcde...");
  assert.equal(result.length, 8);
});

test("truncateText handles exact boundary", () => {
  assert.equal(truncateText("12345", 5), "12345");
});

// --- safeJsonStringify ---

test("safeJsonStringify redacts and stringifies", () => {
  const result = safeJsonStringify({ api_key: "secret", name: "ok" });
  assert.ok(result.includes("[REDACTED]"));
  assert.ok(result.includes("ok"));
});

test("safeJsonStringify truncates long output", () => {
  const bigObj = { data: "x".repeat(20000) };
  const result = safeJsonStringify(bigObj, 100);
  assert.ok(result.length <= 100);
  assert.ok(result.endsWith("..."));
});

test("safeJsonStringify handles null/undefined", () => {
  assert.equal(safeJsonStringify(null), "{}");
  assert.equal(safeJsonStringify(undefined), "{}");
});
