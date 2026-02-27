import { ApiError } from "./types";

export function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(error: ApiError & { correlation_id?: string; headers?: HeadersInit }) {
  const body = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      correlation_id: error.correlation_id,
    },
    details: error.details,
  };
  const headers = new Headers({
    "Content-Type": "application/json",
  });
  if (error.headers) {
    const extra = new Headers(error.headers);
    for (const [key, value] of extra.entries()) {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(body), {
    status: error.status,
    headers,
  });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function redirect(url: string, status = 302) {
  return new Response(null, {
    status,
    headers: { Location: url },
  });
}
