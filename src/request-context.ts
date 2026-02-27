export function getHeaderCaseInsensitive(headers: Headers, name: string): string | null {
  const target = name.toLowerCase();
  for (const [headerName, headerValue] of headers.entries()) {
    if (headerName.toLowerCase() === target) {
      return headerValue;
    }
  }
  return null;
}

export type ResolvedRequestIds = {
  correlationId: string;
  requestId: string;
};

export function resolveRequestIds(
  headers: Headers,
  generateId: () => string = () => crypto.randomUUID()
): ResolvedRequestIds {
  const incomingCorrelationId =
    getHeaderCaseInsensitive(headers, "x-correlation-id") ||
    getHeaderCaseInsensitive(headers, "correlation-id");
  const cfRay = getHeaderCaseInsensitive(headers, "cf-ray");
  const generated = generateId();
  return {
    correlationId: incomingCorrelationId || generated,
    requestId: cfRay || generated,
  };
}
