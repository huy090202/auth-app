import type { Context } from 'hono';
import type { Factor } from '../authgate/client.js';
import { AppError } from '../lib/http.js';

export type Body = Record<string, unknown>;

export async function readBody(c: Context): Promise<Body> {
  const b: unknown = await c.req.json().catch(() => null);
  if (b === null || typeof b !== 'object' || Array.isArray(b)) throw new AppError(400, 'invalid_body');
  return b as Body;
}

export function parseFactor(v: unknown): Factor {
  if (v !== 'pin' && v !== 'webauthn') throw new AppError(400, 'invalid_factor');
  return v;
}

export function parseId(v: unknown, code: string): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 200) throw new AppError(400, code);
  return v;
}

/** `{pin}` or `{credential}`, exactly one. */
export function parseProof(b: Body): { pin: string } | { credential: unknown } {
  const hasPin = typeof b.pin === 'string' && b.pin.length > 0;
  const hasCred = b.credential !== undefined && b.credential !== null && typeof b.credential === 'object';
  if (hasPin === hasCred) throw new AppError(400, 'invalid_proof');
  return hasPin ? { pin: b.pin as string } : { credential: b.credential };
}
