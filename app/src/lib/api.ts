import { traceStore, type TraceEntry } from '../trace/TraceStore';

export class ApiError extends Error {
  status: number;
  code: string;
  extras: Record<string, unknown>;
  constructor(status: number, code: string, extras: Record<string, unknown>) {
    super(`${status} ${code}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.extras = extras;
  }
}

// Same-origin only: the browser never talks to auth-gate.
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    credentials: 'same-origin',
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (Array.isArray(body.trace)) traceStore.push(body.trace as TraceEntry[]);
  if (!res.ok) {
    const { error, trace: _trace, ...extras } = body;
    void _trace;
    throw new ApiError(res.status, typeof error === 'string' ? error : 'unknown', extras);
  }
  return body as T;
}
