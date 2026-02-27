import { MiddlewareFn } from "../types";
import { jsonError } from "../helpers";

export function getWindowStartSeconds(nowMs: number, windowSeconds: number): number {
  const nowSeconds = Math.floor(nowMs / 1000);
  return Math.floor(nowSeconds / windowSeconds) * windowSeconds;
}

export function getRetryAfterSeconds(nowMs: number, windowStartSeconds: number, windowSeconds: number): number {
  return Math.max(1, windowSeconds - (Math.floor(nowMs / 1000) - windowStartSeconds));
}

export function withRateLimit(opts: {
  keyFn?: (req: Request, ctx: any) => string;
  limit: number;
  windowSeconds: number;
}): MiddlewareFn {
  let hasWarnedMissingDb = false;
  let keyColumn: "bucket_key" | "ip_address" | null = null;

  async function ensureKeyColumn(db: any): Promise<"bucket_key" | "ip_address"> {
    if (keyColumn) return keyColumn;
    try {
      await db
        .prepare(
          `INSERT INTO api_rate_limits (bucket_key, window_start, request_count)
           VALUES (?, ?, 1)
           ON CONFLICT(bucket_key, window_start)
           DO UPDATE SET request_count = request_count + 1`
        )
        .bind("__probe__", 0)
        .run();
      await db.prepare("DELETE FROM api_rate_limits WHERE bucket_key = ? AND window_start = ?").bind("__probe__", 0).run();
      keyColumn = "bucket_key";
    } catch {
      keyColumn = "ip_address";
    }
    return keyColumn;
  }

  return async (req, ctx, next) => {
    if (!ctx.env.DB) {
      if (!hasWarnedMissingDb) {
        hasWarnedMissingDb = true;
        console.warn("[api-middleware] withRateLimit skipped because DB binding is missing");
      }
      return next();
    }

    const db = ctx.env.DB;
    const bucketKey = opts.keyFn ? opts.keyFn(req, ctx) : (ctx.ip || "unknown");
    const column = await ensureKeyColumn(db);
    const nowMs = Date.now();
    const windowStart = getWindowStartSeconds(nowMs, opts.windowSeconds);
    const retryAfterSeconds = getRetryAfterSeconds(nowMs, windowStart, opts.windowSeconds);

    try {
      await db.prepare(
          `INSERT INTO api_rate_limits (${column}, window_start, request_count)
           VALUES (?, ?, 1)
           ON CONFLICT(${column}, window_start)
           DO UPDATE SET request_count = request_count + 1`
        )
        .bind(bucketKey, windowStart)
        .run();

      const row = await db.prepare(`SELECT request_count FROM api_rate_limits WHERE ${column} = ? AND window_start = ?`)
        .bind(bucketKey, windowStart)
        .first() as { request_count: number } | null;

      const count = Number(row?.request_count || 0);

      // Clean up async roughly 1/100 times
      if (Math.random() < 0.01) {
         db.prepare("DELETE FROM api_rate_limits WHERE window_start < ?").bind(windowStart - opts.windowSeconds * 2).run();
      }

      if (count > opts.limit) {
         return jsonError({
            status: 429,
            code: "rate_limited",
            message: "Too many requests, please wait",
            correlation_id: ctx.correlation_id,
            headers: {
              "Retry-After": String(retryAfterSeconds),
            },
         });
      }
    } catch {
      // Ignore schema missing errors unless we want to crash 
      // or we can auto-create api_rate_limits table
    }

    return next();
  };
}
