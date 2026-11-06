import { AppError } from '../lib/http.js';
import type { TraceRecorder } from '../lib/trace.js';

export type Factor = 'pin' | 'webauthn';

export type FactorsView = {
  pin: boolean;
  webauthn: { credentialId: string; createdAt: string; lastUsedAt?: string }[];
};

type Reply = { status: number; body: unknown };
type Json = Record<string, unknown>;

const enc = encodeURIComponent;

export class AuthGate {
  private readonly baseUrl: string;
  private readonly clientKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(opts: { baseUrl: string; clientKey: string; fetch?: typeof fetch }) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.clientKey = opts.clientKey;
    this.fetchFn = opts.fetch ?? fetch;
  }

  async setPin(trace: TraceRecorder, subjectId: string, pin: string): Promise<void> {
    await this.call(trace, 'POST', '/api/factors/pin', { subjectId, pin });
  }

  async deletePin(trace: TraceRecorder, subjectId: string): Promise<void> {
    await this.call(trace, 'DELETE', `/api/factors/pin/${enc(subjectId)}`);
  }

  async factors(trace: TraceRecorder, subjectId: string): Promise<FactorsView> {
    const r = await this.call(trace, 'GET', `/api/factors/${enc(subjectId)}`);
    const b = (r.body ?? {}) as Partial<FactorsView>;
    return { pin: b.pin === true, webauthn: b.webauthn ?? [] };
  }

  async startRegistration(
    trace: TraceRecorder,
    subjectId: string,
    displayName?: string,
  ): Promise<{ registrationId: string; publicKey: unknown }> {
    const r = await this.call(trace, 'POST', '/api/webauthn/registrations', {
      subjectId,
      ...(displayName === undefined ? {} : { displayName }),
    });
    const b = r.body as { registrationId: string; publicKey: unknown };
    return { registrationId: b.registrationId, publicKey: b.publicKey };
  }

  async finishRegistration(
    trace: TraceRecorder,
    registrationId: string,
    credential: unknown,
  ): Promise<{ credentialId: string }> {
    const r = await this.call(trace, 'POST', `/api/webauthn/registrations/${enc(registrationId)}`, {
      credential,
    });
    return { credentialId: (r.body as { credentialId: string }).credentialId };
  }

  async deleteCredential(trace: TraceRecorder, subjectId: string, credentialId: string): Promise<void> {
    await this.call(
      trace,
      'DELETE',
      `/api/webauthn/credentials/${enc(credentialId)}?subjectId=${enc(subjectId)}`,
    );
  }

  async createChallenge(
    trace: TraceRecorder,
    subjectId: string,
    purpose: string,
    factor: Factor,
  ): Promise<{ challengeId: string; expiresAt: string; publicKey?: unknown }> {
    const r = await this.call(trace, 'POST', '/api/challenges', { subjectId, purpose, factor });
    const b = r.body as { challengeId: string; expiresAt: string; publicKey?: unknown };
    return b.publicKey === undefined
      ? { challengeId: b.challengeId, expiresAt: b.expiresAt }
      : { challengeId: b.challengeId, expiresAt: b.expiresAt, publicKey: b.publicKey };
  }

  async verifyChallenge(
    trace: TraceRecorder,
    challengeId: string,
    body: { pin: string } | { credential: unknown },
  ): Promise<{ token: string; expiresAt: string; factor: Factor }> {
    const r = await this.call(trace, 'POST', `/api/challenges/${enc(challengeId)}/verify`, body);
    const b = r.body as { token: string; expiresAt: string; factor: Factor };
    return { token: b.token, expiresAt: b.expiresAt, factor: b.factor };
  }

  private async call(trace: TraceRecorder, method: string, path: string, body?: unknown): Promise<Reply> {
    const started = Date.now();
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'x-internal-access-key': this.clientKey,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      trace.record({ method, path, requestBody: body, status: 0, responseBody: null, ms: Date.now() - started });
      throw new AppError(502, 'authgate_unavailable');
    }
    const text = await res.text().catch(() => '');
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    trace.record({
      method,
      path,
      requestBody: body,
      status: res.status,
      responseBody: parsed,
      ms: Date.now() - started,
    });
    if (res.ok) return { status: res.status, body: parsed };
    throw mapError(res.status, parsed, res.headers);
  }
}

function mapError(status: number, body: unknown, headers: Headers): AppError {
  const b = (body ?? {}) as Json;
  const code = typeof b.error === 'string' ? b.error : '';
  if (status >= 500) return new AppError(502, 'authgate_unavailable');
  if (status === 400 && code === 'verification_failed') {
    return new AppError(400, 'verification_failed', { attemptsRemaining: b.attemptsRemaining });
  }
  if (status === 423) return new AppError(423, 'locked', { lockedUntil: b.lockedUntil });
  if (status === 410) return new AppError(410, 'challenge_gone');
  if (status === 404 && code === 'factor_not_found') return new AppError(409, 'factor_not_enrolled');
  if (status === 400 && (code === 'registration_failed' || code === 'pin_rejected')) {
    return new AppError(400, code);
  }
  if (status === 429 && code === 'rate_limited') {
    const retryAfter = headers.get('retry-after');
    return new AppError(429, 'rate_limited', retryAfter && /^\d+$/.test(retryAfter) ? { retryAfter: Number(retryAfter) } : {});
  }
  return new AppError(502, 'authgate_unavailable', { upstream: code || String(status) });
}
