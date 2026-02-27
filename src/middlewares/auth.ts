import { MiddlewareFn } from "../types";
import { jsonError } from "../helpers";
import { OBSERVABILITY_ACTIONS } from "../actions";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacBase64(secret: string, payload: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createHmacSignature(secret: string, payload: string): Promise<string> {
  return hmacBase64(secret, payload);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function verifyHmacSignature(args: {
  secret: string;
  payload: string;
  signature: string;
}): Promise<boolean> {
  const expected = await hmacBase64(args.secret, args.payload);
  return timingSafeEqual(expected, args.signature);
}

export function withAuthHmac(opts: {
  secretEnvKey: string;
  toleranceSeconds?: number;
  replayProtection?: boolean;
  skip?: (req: Request, ctx: { env: Record<string, unknown>; state: Record<string, unknown> }) => boolean;
}): MiddlewareFn {
  const { secretEnvKey, toleranceSeconds = 300, replayProtection = true, skip } = opts;

  async function writeAuthLog(args: {
    ctx: any;
    req: Request;
    level: "security" | "warn" | "error" | "info";
    action: string;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
  }) {
    const { ctx, req } = args;
    if (!ctx.env?.DB) {
      return;
    }
    try {
      const queryParams = Object.fromEntries(new URL(req.url).searchParams.entries());
      await ctx.env.DB.prepare(
        `INSERT INTO event_logs
         (id, created_at, level, source, action, correlation_id, user_email, user_id, entity_type, entity_id, message, data_json, request_id, event_type, ip_address, duration_ms, method, path, status_code, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        args.level,
        "api",
        args.action,
        ctx.correlation_id,
        ctx.user_email || null,
        ctx.user_id || null,
        null,
        null,
        args.message,
        JSON.stringify({}),
        ctx.request_id || null,
        "security",
        ctx.ip || null,
        null,
        req.method,
        ctx.route || new URL(req.url).pathname,
        args.statusCode,
        JSON.stringify({
          query: queryParams,
          user_agent: ctx.user_agent || null,
          ...(args.details || {}),
        })
      ).run();
    } catch (error) {
      console.warn("[withAuthHmac] non-fatal auth log failure", {
        correlation_id: ctx.correlation_id,
        code: "db_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return async (req, ctx, next) => {
    if (skip?.(req, ctx as unknown as { env: Record<string, unknown>; state: Record<string, unknown> })) {
      return next();
    }
    const secret = String(ctx.env[secretEnvKey] || "").trim();
    if (!secret) {
      await writeAuthLog({
        ctx,
        req,
        level: "error",
        action: OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL,
        message: "HMAC auth misconfiguration",
        statusCode: 500,
      });
      return jsonError({ status: 500, code: "misconfiguration", message: "Server misconfiguration: missing HMAC secret", correlation_id: ctx.correlation_id });
    }

    const timestamp = req.headers.get("x-oi-timestamp") || "";
    const nonce = req.headers.get("x-oi-nonce") || "";
    const signature = req.headers.get("x-oi-signature") || "";

    if (!timestamp || !nonce || !signature) {
      await writeAuthLog({
        ctx,
        req,
        level: "security",
        action: OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL,
        message: "Missing required HMAC headers",
        statusCode: 401,
      });
      return jsonError({ status: 401, code: "unauthorized", message: "Missing required HMAC headers", correlation_id: ctx.correlation_id });
    }

    const ts = Number(timestamp || "0");
    if (!Number.isFinite(ts)) {
      await writeAuthLog({
        ctx,
        req,
        level: "security",
        action: OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL,
        message: "Invalid HMAC timestamp",
        statusCode: 401,
      });
      return jsonError({ status: 401, code: "unauthorized", message: "Invalid timestamp", correlation_id: ctx.correlation_id });
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > toleranceSeconds) {
      await writeAuthLog({
        ctx,
        req,
        level: "security",
        action: OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL,
        message: "Timestamp outside tolerance window",
        statusCode: 401,
      });
      return jsonError({ status: 401, code: "unauthorized", message: "Timestamp outside tolerance window", correlation_id: ctx.correlation_id });
    }

    const method = req.method.toUpperCase();
    const bodyText = method === "GET" || method === "HEAD" ? "" : (await req.clone().text());
    const bodyHash = await sha256Hex(bodyText || "");
    const url = new URL(req.url);
    const pathWithSearch = `${url.pathname}${url.search || ""}`

    let payload = `${method}\n${pathWithSearch}\n${timestamp}\n${nonce}\n${bodyHash}`;
    let expected = await hmacBase64(secret, payload);

    if (!timingSafeEqual(expected, signature)) {
      // Fallback for older clients signing just pathname
      if (url.search) {
        payload = `${method}\n${url.pathname}\n${timestamp}\n${nonce}\n${bodyHash}`;
        expected = await hmacBase64(secret, payload);
      }
      if (!timingSafeEqual(expected, signature)) {
         await writeAuthLog({
          ctx,
          req,
          level: "security",
          action: OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL,
          message: "Invalid HMAC signature",
          statusCode: 401,
         });
         return jsonError({ status: 401, code: "unauthorized", message: "Invalid signature", correlation_id: ctx.correlation_id });
      }
    }

    if (replayProtection && ctx.env.DB) {
      // D1 binding required
      const db = ctx.env.DB;
      const CREATE = "CREATE TABLE IF NOT EXISTS api_nonces (nonce TEXT PRIMARY KEY, created_at TEXT NOT NULL)";
      await db.prepare(CREATE).run();
      const existing = await db.prepare("SELECT nonce FROM api_nonces WHERE nonce = ?").bind(nonce).first();
      if (existing) {
        await writeAuthLog({
          ctx,
          req,
          level: "security",
          action: OBSERVABILITY_ACTIONS.AUTH_HMAC_FAIL,
          message: "HMAC nonce replay detected",
          statusCode: 403,
        });
        return jsonError({ status: 403, code: "forbidden", message: "Nonce replay detected", correlation_id: ctx.correlation_id });
      }
      await db.prepare("INSERT INTO api_nonces (nonce, created_at) VALUES (?, ?)").bind(nonce, new Date().toISOString()).run();
      // Cleanup chance for performance: maybe trigger this via cron or just 10% chance
      if (Math.random() < 0.1) {
        await db.prepare("DELETE FROM api_nonces WHERE created_at < datetime('now', '-10 minutes')").run();
      }
    }

    await writeAuthLog({
      ctx,
      req,
      level: "security",
      action: OBSERVABILITY_ACTIONS.AUTH_HMAC_OK,
      message: "HMAC auth passed",
      statusCode: 200,
    });

    return next();
  };
}
