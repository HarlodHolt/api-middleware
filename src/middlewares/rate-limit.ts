import { MiddlewareFn } from "../types";
import { jsonError } from "../helpers";

export function withRateLimit(opts: {
  keyFn?: (req: Request, ctx: any) => string;
  limit: number;
  windowSeconds: number;
}): MiddlewareFn {
  return async (req, ctx, next) => {
    if (!ctx.env.DB) return next();

    const db = ctx.env.DB;
    const key = opts.keyFn ? opts.keyFn(req, ctx) : (ctx.ip || "unknown");
    const windowMs = opts.windowSeconds * 1000;
    const nowMs = Date.now();
    const windowStart = Math.floor(nowMs / windowMs) * windowMs;

    try {
      await db.prepare(
          `INSERT INTO api_rate_limits (ip_address, window_start, request_count)
           VALUES (?, ?, 1)
           ON CONFLICT(ip_address, window_start)
           DO UPDATE SET request_count = request_count + 1`
        )
        .bind(key, windowStart)
        .run();

      const row = await db.prepare("SELECT request_count FROM api_rate_limits WHERE ip_address = ? AND window_start = ?")
        .bind(key, windowStart)
        .first() as { request_count: number } | null;

      const count = Number(row?.request_count || 0);

      // Clean up async roughly 1/100 times
      if (Math.random() < 0.01) {
         db.prepare("DELETE FROM api_rate_limits WHERE window_start < ?").bind(windowStart - windowMs * 2).run();
      }

      if (count > opts.limit) {
         return jsonError({ status: 429, code: "rate_limited", message: "Too many requests, please wait", correlation_id: ctx.correlation_id });
      }
    } catch {
      // Ignore schema missing errors unless we want to crash 
      // or we can auto-create api_rate_limits table
    }

    return next();
  };
}
