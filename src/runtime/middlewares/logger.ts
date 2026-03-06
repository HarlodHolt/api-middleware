import { OBSERVABILITY_ACTIONS } from "../actions";
import { ConsoleSink, D1EventLogsSink, writeLogWithFailSafe } from "../logging";
import type { D1DatabaseLike, LogEvent, LogSink, MiddlewareFunction } from "../types";

function parseSampleRate(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, numericValue));
}

function parseInteger(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return numericValue;
}

function deterministicHashToUnitInterval(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0) / 4294967295;
}

function resolveSink(context: { env: Record<string, unknown> }, explicitSink?: LogSink): LogSink {
  if (explicitSink) {
    return explicitSink;
  }

  const environmentSink = context.env.LOG_SINK;
  if (environmentSink && typeof (environmentSink as LogSink).write === "function") {
    return environmentSink as LogSink;
  }

  if (context.env.DB) {
    return new D1EventLogsSink(context.env.DB as D1DatabaseLike);
  }

  return new ConsoleSink();
}

function shouldLog(
  level: "info" | "warn" | "error",
  requestId: string,
  durationMs: number,
  context: { env: Record<string, unknown> },
): boolean {
  if (level === "warn" || level === "error") {
    return true;
  }

  const slowThresholdMilliseconds = parseInteger(context.env.LOG_ALWAYS_LOG_SLOW_MS, 1500);
  if (durationMs >= slowThresholdMilliseconds) {
    return true;
  }

  const infoSampleRate = parseSampleRate(context.env.LOG_SAMPLE_RATE_INFO, 0.2);
  const sampleBucket = deterministicHashToUnitInterval(requestId);
  return sampleBucket <= infoSampleRate;
}

export function withLogging(options?: { action_prefix?: string; sink?: LogSink }): MiddlewareFunction {
  return async (request, context, next) => {
    const requestStart = Date.now();
    let response: Response | null = null;
    let unhandledError: unknown = null;

    try {
      response = await next();
      return response;
    } catch (error) {
      unhandledError = error;
      throw error;
    } finally {
      if (!context.state.__request_logged) {
        context.state.__request_logged = true;

        const requestDuration = Date.now() - requestStart;
        const statusCode = response?.status ?? 500;
        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
        const resolvedRequestId = context.request_id || context.correlation_id || crypto.randomUUID();

        if (shouldLog(level, resolvedRequestId, requestDuration, context)) {
          let responseJson: unknown = null;
          if (response && (response.headers.get("content-type") || "").includes("application/json")) {
            try {
              responseJson = await response.clone().json();
            } catch {
              responseJson = null;
            }
          }

          const logEvent: LogEvent = {
            level,
            action:
              statusCode >= 500 || unhandledError
                ? OBSERVABILITY_ACTIONS.HTTP_ERROR
                : OBSERVABILITY_ACTIONS.HTTP_RESPONSE,
            message: `${context.method} ${context.route} -> ${statusCode}`,
            correlation_id: context.correlation_id,
            request_id: resolvedRequestId,
            route: context.route,
            method: context.method,
            status: statusCode,
            duration_ms: requestDuration,
            ip: context.ip,
            user_agent: context.user_agent,
            user_id: context.user_id || null,
            user_email: context.user_email || null,
            metadata: {
              action_prefix: options?.action_prefix || null,
              user_agent: context.user_agent || null,
              ip_address: context.ip || null,
              request_json: {
                query: Object.fromEntries(new URL(request.url).searchParams.entries()),
                parsed_body_keys:
                  context.state.parsed_body && typeof context.state.parsed_body === "object"
                    ? Object.keys(context.state.parsed_body as Record<string, unknown>)
                    : [],
              },
              response_json: responseJson,
              auth_action: context.state.auth_action || null,
              rate_limit_action: context.state.rate_limit_action || null,
            },
          };

          await writeLogWithFailSafe(resolveSink(context, options?.sink), logEvent);
        }
      }
    }
  };
}
