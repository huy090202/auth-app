import { ApiError } from '../lib/api';

export type Status = 'loading' | 'anon' | 'half' | 'full' | 'error';

/**
 * What a failed GET /api/me says about the session. Only a 401 says anything: being rate
 * limited, or AuthGate being down, does not sign the user out.
 */
export function statusAfterError(e: unknown): Status {
  if (!(e instanceof ApiError)) return 'error';
  if (e.code === 'second_factor_required') return 'half';
  return e.status === 401 ? 'anon' : 'error';
}
