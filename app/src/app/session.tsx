import { Loader } from '@mantine/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { useStrings, type Strings } from './strings';

export type Passkey = { credentialId: string; createdAt: string; lastUsedAt?: string };
export type Me = { username: string; email: string; factors: { pin: boolean; webauthn: Passkey[] } };
export type Status = 'loading' | 'anon' | 'half' | 'full';

/** The current session, from GET /api/me. */
export function useMe(): { me: Me | null; status: Status; reload: () => Promise<void> } {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>('/api/me'));
      setStatus('full');
    } catch (e) {
      setMe(null);
      setStatus(e instanceof ApiError && e.code === 'second_factor_required' ? 'half' : 'anon');
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { me, status, reload };
}

/** Renders children only for a full session; otherwise sends the user to the right step. */
export function SessionGuard({ children }: { children: (s: { me: Me; reload: () => Promise<void> }) => ReactNode }) {
  const { me, status, reload } = useMe();
  const t = useStrings();
  if (status === 'loading') return <Loader size="sm" aria-label={t.loading} />;
  if (status === 'anon') return <Navigate to="/app/login" replace />;
  if (status === 'half') return <Navigate to="/app/login/second-factor" replace />;
  return <>{children({ me: me!, reload })}</>;
}

/** One sentence for an error we do not handle specially. */
export function describe(e: unknown, t: Strings): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : t.somethingWrong;
  switch (e.code) {
    case 'network_error':
      return t.errNetwork;
    case 'authgate_unavailable':
      return t.errUnavailable;
    case 'unauthorized':
      return t.errUnauthorized;
    default:
      return (t.errors as Record<string, string | undefined>)[e.code] ?? t.errUnknown(e.code, e.status);
  }
}

/** A cancelled or timed-out browser prompt is not an error worth a red line. */
export const isCancelled = (e: unknown) => e instanceof DOMException && e.name === 'NotAllowedError';
