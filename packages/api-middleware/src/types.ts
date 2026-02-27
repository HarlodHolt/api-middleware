export interface ApiEnv {
  DB?: any;         
  KV?: any;         
  HMAC_SHARED_SECRET?: string;
  [key: string]: unknown;
}

export interface RequestContext {
  correlation_id: string;
  request_id?: string | null;
  start_ms: number;
  ip: string | null;
  user_agent: string | null;
  route: string;
  method: string;
  user_id?: string | null;
  user_email?: string | null;
  [key: string]: unknown;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
  cause?: unknown;
  headers?: HeadersInit;
}

export type MiddlewareContext = RequestContext & {
  env: ApiEnv;
  state: Record<string, unknown>;
};

export type NextFn = () => Promise<Response>;

export type MiddlewareFn = (
  req: Request,
  ctx: MiddlewareContext,
  next: NextFn
) => Promise<Response>;

export type HandlerFn = (req: Request, ctx: MiddlewareContext) => Promise<Response> | Response;
