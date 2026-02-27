import { MiddlewareFn } from "../types";
import { jsonError } from "../helpers";

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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function withAuthHmac(opts: {
  secretEnvKey: string;
  toleranceSeconds?: number;
  replayProtection?: boolean;
}): MiddlewareFn {
  const { secretEnvKey, toleranceSeconds = 300, replayProtection = true } = opts;

  return async (req, ctx, next) => {
    const secret = String(ctx.env[secretEnvKey] || "").trim();
    if (!secret) return jsonError({ status: 500, code: "misconfiguration", message: "Server misconfiguration: missing HMAC secret", correlation_id: ctx.correlation_id });

    const timestamp = req.headers.get("x-oi-timestamp") || "";
    const nonce = req.headers.get("x-oi-nonce") || "";
    const signature = req.headers.get("x-oi-signature") || "";

    if (!timestamp || !nonce || !signature) {
      return jsonError({ status: 401, code: "unauthorized", message: "Missing required HMAC headers", correlation_id: ctx.correlation_id });
    }

    const ts = Number(timestamp || "0");
    if (!Number.isFinite(ts)) return jsonError({ status: 401, code: "unauthorized", message: "Invalid timestamp", correlation_id: ctx.correlation_id });
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > toleranceSeconds) return jsonError({ status: 401, code: "unauthorized", message: "Timestamp outside tolerance window", correlation_id: ctx.correlation_id });

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
        return jsonError({ status: 401, code: "unauthorized", message: "Nonce replay detected", correlation_id: ctx.correlation_id });
      }
      await db.prepare("INSERT INTO api_nonces (nonce, created_at) VALUES (?, ?)").bind(nonce, new Date().toISOString()).run();
      // Cleanup chance for performance: maybe trigger this via cron or just 10% chance
      if (Math.random() < 0.1) {
        await db.prepare("DELETE FROM api_nonces WHERE created_at < datetime('now', '-10 minutes')").run();
      }
    }

    return next();
  };
}
