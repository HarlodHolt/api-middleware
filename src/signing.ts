import { createHmacSignature } from "./runtime/middlewares/auth.js";

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSignedHeaders(args: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string; // should be pathname + search (e.g. "/api/orders?status=paid")
  bodyText: string;
  secret: string;
  correlationId?: string;
}) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const bodyHash = await sha256Hex(args.bodyText);
  // Always include query string in the payload (primary format on the server).
  const signaturePath = args.path || "/";
  const payloadString = `${args.method}\n${signaturePath}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const signature = await createHmacSignature(args.secret, payloadString);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-oi-timestamp": timestamp,
    "x-oi-nonce": nonce,
    "x-oi-signature": signature,
  };
  if (args.correlationId) {
    headers["x-correlation-id"] = args.correlationId;
  }
  return headers;
}

export async function signedApiFetch<T = Record<string, unknown>>(args: {
  baseUrl: string;
  secret: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  correlationId?: string;
  clientHeaders?: Headers | Record<string, string> | null;
}) {
  const { baseUrl, secret } = args;
  
  if (!secret) {
    return {
      ok: false,
      status: 500,
      data: { ok: false, error: "Configuration error: missing HMAC_SHARED_SECRET" } as T,
    };
  }

  const bodyText = args.body === undefined ? "" : JSON.stringify(args.body);
  const headers = await createSignedHeaders({
    method: args.method,
    path: args.path,
    bodyText,
    secret,
    correlationId: args.correlationId,
  });

  // Polyfill `get` for headers if it's a raw object
  const getHeader = (key: string) => {
    if (!args.clientHeaders) return undefined;
    if (typeof (args.clientHeaders as Headers).get === "function") {
      return (args.clientHeaders as Headers).get(key);
    }
    return (args.clientHeaders as Record<string, string>)[key];
  };

  const cfConnectingIp = getHeader("cf-connecting-ip")?.trim();
  const forwardedFor = getHeader("x-forwarded-for")?.trim();
  const userAgent = getHeader("user-agent")?.trim();
  
  if (cfConnectingIp) headers["cf-connecting-ip"] = cfConnectingIp;
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;
  if (userAgent) headers["user-agent"] = userAgent;

  const res = await fetch(`${baseUrl}${args.path}`, {
    method: args.method,
    headers,
    body: bodyText || undefined,
  });

  const text = await res.text();
  let json: T | Record<string, string> | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok, status: res.status, data: json as T };
}
