import { OBSERVABILITY_ACTIONS } from "../actions";
import { jsonError } from "../helpers";
import type { AuthHmacConfig, MiddlewareFunction } from "../types";

async function sha256Hex(input: string): Promise<string> {
  const inputBytes = new TextEncoder().encode(input);
  const digestBuffer = await crypto.subtle.digest("SHA-256", inputBytes);
  return [...new Uint8Array(digestBuffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacBase64(secret: string, payload: string): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let accumulator = 0;
  for (let index = 0; index < a.length; index += 1) {
    accumulator |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return accumulator === 0;
}

export async function createHmacSignature(secret: string, payload: string): Promise<string> {
  return hmacBase64(secret, payload);
}

export async function verifyHmacSignature(input: {
  secret: string;
  payload: string;
  signature: string;
}): Promise<boolean> {
  const expectedSignature = await hmacBase64(input.secret, input.payload);
  return timingSafeEqual(expectedSignature, input.signature);
}

export function withAuthHmac(configuration: AuthHmacConfig): MiddlewareFunction {
  const toleranceSeconds = configuration.tolerance_seconds ?? 300;

  return async (request, context, next) => {
    if (configuration.skip?.(request, context)) {
      return next();
    }

    const secretValue = String(context.env[configuration.secret_env_key] || "").trim();
    if (!secretValue) {
      return jsonError(
        {
          status: 500,
          code: "misconfiguration",
          message: "Server misconfiguration: missing HMAC secret",
        },
        context,
      );
    }

    const timestamp = request.headers.get("x-oi-timestamp") || "";
    const nonce = request.headers.get("x-oi-nonce") || "";
    const providedSignature = request.headers.get("x-oi-signature") || "";

    if (!timestamp || !nonce || !providedSignature) {
      context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
      return jsonError(
        {
          status: 401,
          code: "unauthorized",
          message: "Missing required HMAC headers",
        },
        context,
      );
    }

    const parsedTimestamp = Number(timestamp);
    if (!Number.isFinite(parsedTimestamp)) {
      context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
      return jsonError(
        {
          status: 401,
          code: "unauthorized",
          message: "Invalid timestamp",
        },
        context,
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - parsedTimestamp) > toleranceSeconds) {
      context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
      return jsonError(
        {
          status: 401,
          code: "unauthorized",
          message: "Timestamp outside tolerance window",
        },
        context,
      );
    }

    const requestMethod = request.method.toUpperCase();
    const requestBodyText = requestMethod === "GET" || requestMethod === "HEAD" ? "" : await request.clone().text();
    const bodyHash = await sha256Hex(requestBodyText);

    const requestUrl = new URL(request.url);
    const payloadWithQuery = `${requestMethod}\n${requestUrl.pathname}${requestUrl.search}\n${timestamp}\n${nonce}\n${bodyHash}`;

    let expectedSignature = await hmacBase64(secretValue, payloadWithQuery);
    let signatureMatches = timingSafeEqual(expectedSignature, providedSignature);

    if (!signatureMatches && requestUrl.search) {
      const legacyPayload = `${requestMethod}\n${requestUrl.pathname}\n${timestamp}\n${nonce}\n${bodyHash}`;
      expectedSignature = await hmacBase64(secretValue, legacyPayload);
      signatureMatches = timingSafeEqual(expectedSignature, providedSignature);
    }

    if (!signatureMatches) {
      context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL;
      return jsonError(
        {
          status: 401,
          code: "unauthorized",
          message: "Invalid signature",
        },
        context,
      );
    }

    context.state.auth_action = OBSERVABILITY_ACTIONS.AUTH_HMAC_OK;
    return next();
  };
}
