import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import type { TraceRecorder } from './trace.js';

export type Vars = { trace: TraceRecorder };
// Any context whose variables include the trace recorder.
type AnyCtx<V extends Vars> = Context<{ Variables: V }>;

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extras: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

function withTrace<V extends Vars>(c: AnyCtx<V>, body: object): object {
  // `trace` is owned by the recorder: drop any caller-supplied key.
  const rest: Record<string, unknown> = { ...body };
  delete rest.trace;
  const trace = (c.var as Vars).trace?.entries();
  return trace && trace.length > 0 ? { ...rest, trace } : rest;
}

export function jsonOk<V extends Vars>(c: AnyCtx<V>, status: 200 | 201, body: object): Response {
  return c.json(withTrace(c, body), status);
}

export function jsonError<V extends Vars>(c: AnyCtx<V>, err: AppError): Response {
  return c.json(
    withTrace(c, { ...err.extras, error: err.code }),
    err.status as 400 | 401 | 403 | 404 | 409 | 410 | 423 | 429 | 500 | 502,
  );
}

export const errorHandler: ErrorHandler<{ Variables: Vars }> = (err, c) => {
  if (err instanceof AppError) return jsonError(c, err);
  console.error(err);
  return jsonError(c, new AppError(500, 'internal'));
};

export const notFound: NotFoundHandler<{ Variables: Vars }> = (c) =>
  jsonError(c, new AppError(404, 'not_found'));
