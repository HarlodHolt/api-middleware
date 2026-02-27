import type { D1DatabaseLike, LogEvent, LogSink } from "./types";

// Canonical list — any key whose lowercase form contains one of these substrings
// will have its value replaced with "[REDACTED]" before being written to any log sink.
// This is the single source of truth; do not maintain a separate list in any app repo.
const REDACTED_KEYS = [
  "authorization",
  "cookie",
  "set-cookie",
  "api_key",
  "apikey",
  "openai_api_key",
  "token",
  "secret",
  "password",
  "hmac_shared_secret",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "google_places_api_key",
];

function shouldRedactKey(key: string): boolean {
  const keyLower = key.toLowerCase();
  return REDACTED_KEYS.some((sensitiveKey) => keyLower.includes(sensitiveKey));
}

export function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitive(entry));
  }

  if (typeof value !== "object") {
    return value;
  }

  const original = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(original)) {
    if (shouldRedactKey(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    sanitized[key] = redactSensitive(nestedValue);
  }

  return sanitized;
}

export function truncateText(text: string, maxLength = 2000): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

export function safeJsonStringify(value: unknown, maxLength = 16_000): string {
  const sanitized = redactSensitive(value);
  const jsonString = JSON.stringify(sanitized ?? {});
  if (!jsonString) {
    return "{}";
  }
  return truncateText(jsonString, maxLength);
}

function buildInsertValues(event: LogEvent) {
  // Column order must match the INSERT statement in D1EventLogsSink.write():
  // id, created_at, level, source, action, correlation_id,
  // user_email, user_id, entity_type, entity_id, message, data_json,
  // request_id, event_type, ip_address, duration_ms, method, path, status_code, metadata
  return [
    crypto.randomUUID(),           // id
    new Date().toISOString(),      // created_at
    event.level,                   // level
    "api",                         // source
    event.action,                  // action
    event.correlation_id,          // correlation_id
    event.user_email ?? null,      // user_email — was incorrectly hardcoded null before
    event.user_id ?? null,         // user_id
    null,                          // entity_type (not applicable for HTTP logs)
    null,                          // entity_id
    event.message,                 // message
    safeJsonStringify(event.metadata ?? {}), // data_json
    event.request_id,              // request_id
    "http",                        // event_type
    event.ip,                      // ip_address
    event.duration_ms,             // duration_ms
    event.method,                  // method
    event.route,                   // path
    event.status,                  // status_code
    safeJsonStringify(event.metadata ?? {}), // metadata
  ];
}

export class ConsoleSink implements LogSink {
  async write(event: LogEvent): Promise<void> {
    console.log(
      JSON.stringify({
        created_at: new Date().toISOString(),
        ...event,
        metadata: redactSensitive(event.metadata ?? {}),
      }),
    );
  }
}

export class D1EventLogsSink implements LogSink {
  private readonly database: D1DatabaseLike;

  constructor(database: D1DatabaseLike) {
    this.database = database;
  }

  async write(event: LogEvent): Promise<void> {
    const statement = this.database.prepare(
      `INSERT INTO event_logs
      (id, created_at, level, source, action, correlation_id, user_email, user_id, entity_type, entity_id, message, data_json, request_id, event_type, ip_address, duration_ms, method, path, status_code, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    await statement.bind(...buildInsertValues(event)).run();
  }
}

export async function writeLogWithFailSafe(sink: LogSink, event: LogEvent): Promise<void> {
  try {
    await sink.write(event);
  } catch (error) {
    console.warn("[api-middleware] log sink failure", {
      correlation_id: event.correlation_id,
      code: "log_sink_failed",
      message: error instanceof Error ? truncateText(error.message, 300) : "Unknown sink error",
    });
  }
}
