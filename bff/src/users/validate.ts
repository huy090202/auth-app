import { AppError } from '../lib/http.js';

const USERNAME = /^[a-z0-9_.-]{3,32}$/;

export function parseUsername(v: unknown): string {
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  if (!USERNAME.test(s)) throw new AppError(400, 'invalid_username');
  return s;
}

export function parsePassword(v: unknown): string {
  if (typeof v !== 'string' || v.length < 8 || v.length > 128) {
    throw new AppError(400, 'invalid_password');
  }
  return v;
}

export function parseEmail(v: unknown): string {
  if (typeof v !== 'string' || v.length > 254) throw new AppError(400, 'invalid_email');
  const parts = v.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1] || /\s/.test(v)) {
    throw new AppError(400, 'invalid_email');
  }
  return v.toLowerCase();
}
