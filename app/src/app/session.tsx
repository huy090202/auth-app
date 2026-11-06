import { Button, Loader, Stack, Text } from '@mantine/core';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { statusAfterError, type Status } from './session-status';
import { useStrings, type Strings } from './strings';

export type Passkey = { credentialId: string; createdAt: string; lastUsedAt?: string };
export type Me = { username: string; email: string; factors: { pin: boolean; webauthn: Passkey[] } };

/**
 * The current session, from GET /api/me. `reload` rejects only when a page that is already
 * showing could not refresh: the page stays, and the caller's own catch reports the error.
 */
export function useMe(): { me: Me | null; status: Status; error: unknown; reload: () => Promise<void>; retry: () => void } {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<unknown>(null);
  const loaded = useRef(false);
  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>('/api/me'));
      loaded.current = true;
      setStatus('full');
    } catch (e) {
      const next = statusAfterError(e);
      if (next === 'error' && loaded.current) throw e;
      loaded.current = false;
      setMe(null);
      setError(e);
      setStatus(next);
    }
  }, []);
  const retry = useCallback(() => {
    setStatus('loading');
    void reload();
  }, [reload]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { me, status, error, reload, retry };
}

/** Renders children only for a full session; otherwise sends the user to the right step. */
export function SessionGuard({ children }: { children: (s: { me: Me; reload: () => Promise<void> }) => ReactNode }) {
  const { me, status, error, reload, retry } = useMe();
  const t = useStrings();
  if (status === 'loading') return <Loader size="sm" aria-label={t.loading} />;
  if (status === 'anon') return <Navigate to="/app/login" replace />;
  if (status === 'half') return <Navigate to="/app/login/second-factor" replace />;
  if (status === 'error') {
    return (
      <Stack gap="sm" align="flex-start">
        <Text c="red.7" fz="sm" role="alert">{describe(error, t)}</Text>
        <Button size="sm" variant="light" onClick={retry}>{t.retry}</Button>
      </Stack>
    );
  }
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
