import { timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { AppError, jsonError } from './http.js';

export function originVerify(secret: string | null): MiddlewareHandler {
  return async (c, next) => {
    if (secret === null) return next();
    const got = Buffer.from(c.req.header('x-origin-verify') ?? '');
    const want = Buffer.from(secret);
    if (got.length !== want.length || !timingSafeEqual(got, want)) {
      return jsonError(c as never, new AppError(401, 'unauthorized'));
    }
    return next();
  };
}
