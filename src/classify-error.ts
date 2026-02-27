export type ClassifiedError = {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

const DEFAULT_ERROR: ClassifiedError = {
  status: 500,
  code: "internal_error",
  message: "Internal server error",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function classifyError(error: unknown): ClassifiedError {
  if (isRecord(error)) {
    const explicitStatus = Number(error.status);
    const explicitCode = typeof error.code === "string" ? error.code : "";
    const explicitMessage = typeof error.message === "string" ? error.message : "";
    if (Number.isFinite(explicitStatus) && explicitStatus >= 400 && explicitStatus <= 599) {
      return {
        status: explicitStatus,
        code: explicitCode || (explicitStatus >= 500 ? "internal_error" : "bad_request"),
        message: explicitMessage || (explicitStatus >= 500 ? DEFAULT_ERROR.message : "Bad request"),
        details: isRecord(error.details) ? error.details : undefined,
      };
    }
  }

  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const lowered = rawMessage.toLowerCase();

  if (lowered.includes("d1_error") || lowered.includes("sqlite_error")) {
    if (lowered.includes("unique") || lowered.includes("constraint")) {
      return {
        status: 409,
        code: "constraint_error",
        message: "Request conflicts with existing data.",
      };
    }
    if (lowered.includes("no such table") || lowered.includes("no such column")) {
      return {
        status: 500,
        code: "schema_mismatch",
        message: "Database schema is out of date.",
      };
    }
  }

  if (lowered.includes("validation") || lowered.includes("zod")) {
    return {
      status: 400,
      code: "validation_error",
      message: "Request validation failed.",
    };
  }

  if (lowered.includes("signature") || lowered.includes("hmac")) {
    return {
      status: 401,
      code: "unauthorized",
      message: "Unauthorized request.",
    };
  }

  if (lowered.includes("forbidden")) {
    return {
      status: 403,
      code: "forbidden",
      message: "Forbidden request.",
    };
  }

  if (lowered.includes("rate limit") || lowered.includes("too many requests")) {
    return {
      status: 429,
      code: "rate_limited",
      message: "Too many requests, please wait.",
    };
  }

  return {
    ...DEFAULT_ERROR,
    details: error instanceof Error ? { name: error.name, message: error.message } : undefined,
  };
}
