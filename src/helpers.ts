import { ApiError } from "./types";

export function jsonOk(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(error: ApiError & { correlation_id?: string }) {
  const body = {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      correlation_id: error.correlation_id,
    },
    details: error.details,
  };
  return new Response(JSON.stringify(body), {
    status: error.status,
    headers: { "Content-Type": "application/json" },
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
