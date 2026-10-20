import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import type { TraceRecorder } from './trace.js';

export type Vars = { trace: TraceRecorder };
type Ctx = Context<{ Variables: Vars }>;

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extras: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

function withTrace(c: Ctx, body: object): object {
  const trace = c.var.trace?.entries();
  return trace && trace.length > 0 ? { ...body, trace } : body;
}

export function jsonOk(c: Ctx, status: 200 | 201, body: object): Response {
  return c.json(withTrace(c, body), status);
}

export function jsonError(c: Ctx, err: AppError): Response {
  return c.json(
    withTrace(c, { ...err.extras, error: err.code }),
    err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502,
  );
}

export const errorHandler: ErrorHandler<{ Variables: Vars }> = (err, c) => {
  if (err instanceof AppError) return jsonError(c, err);
  console.error(err);
  return jsonError(c, new AppError(500, 'internal'));
};

export const notFound: NotFoundHandler<{ Variables: Vars }> = (c) =>
  jsonError(c, new AppError(404, 'not_found'));
