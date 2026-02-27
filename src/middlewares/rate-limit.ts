import { MiddlewareFn } from "../types";
import { jsonError } from "../helpers";
import { OBSERVABILITY_ACTIONS } from "../actions";

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

  async function writeRateLimitLog(args: {
    ctx: any;
    req: Request;
    level: "info" | "warn" | "error";
    action: string;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
  }) {
    if (!args.ctx.env?.DB) return;
    try {
      const queryParams = Object.fromEntries(new URL(args.req.url).searchParams.entries());
      await args.ctx.env.DB.prepare(
        `INSERT INTO event_logs
         (id, created_at, level, source, action, correlation_id, user_email, user_id, entity_type, entity_id, message, data_json, request_id, event_type, ip_address, duration_ms, method, path, status_code, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        new Date().toISOString(),
        args.level,
        "api",
        args.action,
        args.ctx.correlation_id,
        args.ctx.user_email || null,
        args.ctx.user_id || null,
        null,
        null,
        args.message,
        JSON.stringify({}),
        args.ctx.request_id || null,
        "security",
        args.ctx.ip || null,
        null,
        args.req.method,
        args.ctx.route || new URL(args.req.url).pathname,
        args.statusCode,
        JSON.stringify({
          query: queryParams,
          user_agent: args.ctx.user_agent || null,
          ...(args.details || {}),
        })
      ).run();
    } catch (error) {
      console.warn("[withRateLimit] non-fatal rate-limit log failure", {
        correlation_id: args.ctx.correlation_id,
        code: "db_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
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
         await writeRateLimitLog({
          ctx,
          req,
          level: "warn",
          action: OBSERVABILITY_ACTIONS.RATE_LIMIT_BLOCK,
          message: "Rate limit blocked request",
          statusCode: 429,
          details: {
            bucket_key: bucketKey,
            request_count: count,
            limit: opts.limit,
            window_start: windowStart,
          },
         });
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
      await writeRateLimitLog({
        ctx,
        req,
        level: "info",
        action: OBSERVABILITY_ACTIONS.RATE_LIMIT_OK,
        message: "Rate limit check passed",
        statusCode: 200,
        details: {
          bucket_key: bucketKey,
          request_count: count,
          limit: opts.limit,
          window_start: windowStart,
        },
      });
    } catch {
      await writeRateLimitLog({
        ctx,
        req,
        level: "error",
        action: OBSERVABILITY_ACTIONS.DB_ERROR,
        message: "Rate limit storage failed",
        statusCode: 500,
      });
    }

    return next();
  };
}
