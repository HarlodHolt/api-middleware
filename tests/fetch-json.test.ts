import assert from "node:assert/strict";
import test from "node:test";

import { FetchJsonError, fetchJson } from "../src/fetch-json";

function mockFetch(response: Response) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => response) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

function mockFetchThrow(error: Error) {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw error; }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

test("FetchJsonError has correct properties", () => {
  const err = new FetchJsonError("bad", 422, { ok: false, error: "nope" }, "corr-1", "req-1");
  assert.equal(err.name, "FetchJsonError");
  assert.equal(err.message, "bad");
  assert.equal(err.status, 422);
  assert.equal(err.correlationId, "corr-1");
  assert.equal(err.requestId, "req-1");
  assert.ok(err instanceof Error);
});

test("fetchJson returns parsed JSON on success", async () => {
  const restore = mockFetch(new Response(JSON.stringify({ ok: true, data: 42 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  try {
    const result = await fetchJson<{ ok: boolean; data: number }>("https://example.com/api");
    assert.equal(result.data, 42);
  } finally {
    restore();
  }
});

test("fetchJson throws FetchJsonError on non-2xx", async () => {
  const restore = mockFetch(new Response(
    JSON.stringify({ ok: false, error: { code: "not_found", message: "Gone", correlation_id: "c-1" } }),
    { status: 404 },
  ));
  try {
    await assert.rejects(() => fetchJson("https://example.com/api"), (err: FetchJsonError) => {
      assert.equal(err.status, 404);
      assert.ok(err.message.includes("not_found"));
      assert.ok(err.message.includes("Gone"));
      return true;
    });
  } finally {
    restore();
  }
});

test("fetchJson throws on network failure with status 0", async () => {
  const restore = mockFetchThrow(new TypeError("fetch failed"));
  try {
    await assert.rejects(() => fetchJson("https://example.com/api"), (err: FetchJsonError) => {
      assert.equal(err.status, 0);
      assert.ok(err.message.includes("Network"));
      return true;
    });
  } finally {
    restore();
  }
});

test("fetchJson throws on { ok: false } even with 200 status", async () => {
  const restore = mockFetch(new Response(
    JSON.stringify({ ok: false, error: { code: "logic_error", message: "Nope", correlation_id: "" } }),
    { status: 200 },
  ));
  try {
    await assert.rejects(() => fetchJson("https://example.com/api"), (err: FetchJsonError) => {
      assert.equal(err.status, 200);
      assert.ok(err.message.includes("logic_error"));
      return true;
    });
  } finally {
    restore();
  }
});

test("fetchJson handles non-JSON error response", async () => {
  const restore = mockFetch(new Response("Internal Server Error", {
    status: 500,
    headers: { "content-type": "text/plain" },
  }));
  try {
    await assert.rejects(() => fetchJson("https://example.com/api"), (err: FetchJsonError) => {
      assert.equal(err.status, 500);
      assert.ok(err.message.includes("non-JSON"));
      return true;
    });
  } finally {
    restore();
  }
});

test("fetchJson extracts correlation and request IDs from headers", async () => {
  const restore = mockFetch(new Response(
    JSON.stringify({ ok: false, error: { code: "err", message: "fail", correlation_id: "" } }),
    { status: 400, headers: { "x-correlation-id": "hdr-corr", "x-request-id": "hdr-req" } },
  ));
  try {
    await assert.rejects(() => fetchJson("https://example.com/api"), (err: FetchJsonError) => {
      assert.equal(err.correlationId, "hdr-corr");
      assert.equal(err.requestId, "hdr-req");
      return true;
    });
  } finally {
    restore();
  }
});
