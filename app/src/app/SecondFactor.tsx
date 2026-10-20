import { Anchor, Button, Group, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { serializeCredential, toRequestOptions } from '../lib/webauthn';
import { describe, isCancelled } from './session';

export type LoginFactors = { pin: boolean; webauthn: boolean };
export type Factor = 'pin' | 'webauthn';
type Challenge = { challengeId: string; expiresAt: string; publicKey?: unknown };
type Proof = { pin: string } | { credential: object };

// Login's `factors` survive a reload of the second-factor page.
const KEY = 'auth-app.login-factors';
export function saveFactors(f: LoginFactors) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* storage blocked: the page falls back to offering both */
  }
}
function loadFactors(): LoginFactors {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as LoginFactors | null;
    if (v && typeof v.pin === 'boolean' && typeof v.webauthn === 'boolean') return v;
  } catch {
    /* fall through */
  }
  return { pin: true, webauthn: true };
}

async function proofFor(factor: Factor, ch: Challenge, pin: string): Promise<Proof> {
  if (factor === 'pin') return { pin };
  const cred = (await navigator.credentials.get({ publicKey: toRequestOptions(ch.publicKey) })) as PublicKeyCredential | null;
  if (!cred) throw new DOMException('No credential', 'NotAllowedError');
  return { credential: serializeCredential(cred) };
}

/**
 * PIN or passkey against one start/verify pair. Shared by login's second factor and
 * the step-up modal; only the two endpoints and what happens on success differ.
 */
export function FactorForm<T>({ factors, start, verify, onDone }: {
  factors: LoginFactors;
  start: (factor: Factor) => Promise<Challenge>;
  verify: (challengeId: string, proof: Proof) => Promise<T>;
  onDone: (result: T) => void;
}) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState<Factor | null>(null);
  const [error, setError] = useState('');
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const run = async (factor: Factor) => {
    setBusy(factor);
    setError('');
    setNotEnrolled(false);
    try {
      // An expired challenge (410 challenge_gone) is restarted once without asking.
      for (let attempt = 0; ; attempt++) {
        const ch = await start(factor);
        try {
          onDone(await verify(ch.challengeId, await proofFor(factor, ch, pin)));
          return;
        } catch (e) {
          if (e instanceof ApiError && e.code === 'challenge_gone' && attempt === 0) continue;
          throw e;
        }
      }
    } catch (e) {
      if (isCancelled(e)) return;
      if (!(e instanceof ApiError)) setError(describe(e));
      else if (e.code === 'verification_failed') {
        const left = e.extras.attemptsRemaining;
        setError(
          factor === 'pin' && typeof left === 'number'
            ? `Wrong PIN, ${left} attempts left`
            : 'Verification failed, try again.',
        );
        setPin('');
      } else if (e.code === 'locked') setLockedUntil(String(e.extras.lockedUntil));
      else if (e.code === 'challenge_gone') setError('Expired, try again.');
      else if (e.code === 'factor_not_enrolled') setNotEnrolled(true);
      else setError(describe(e));
    } finally {
      setBusy(null);
    }
  };

  const submitPin = (ev: FormEvent) => {
    ev.preventDefault();
    void run('pin');
  };

  if (lockedUntil) {
    const at = new Date(lockedUntil);
    return (
      <Text role="alert">
        Too many wrong attempts. Locked until {isNaN(at.getTime()) ? lockedUntil : at.toLocaleTimeString()}.
      </Text>
    );
  }

  return (
    <Stack>
      {factors.pin && (
        <form onSubmit={submitPin}>
          <Group align="flex-end">
            <PasswordInput label="PIN" value={pin} onChange={(e) => setPin(e.currentTarget.value)} required
              inputMode="numeric" autoComplete="one-time-code" w={180} disabled={busy !== null} />
            <Button type="submit" loading={busy === 'pin'} disabled={busy === 'webauthn'}>Verify PIN</Button>
          </Group>
        </form>
      )}
      {factors.pin && factors.webauthn && <Text c="dimmed" fz="sm">or</Text>}
      {factors.webauthn && (
        <Group>
          <Button variant={factors.pin ? 'default' : 'filled'} loading={busy === 'webauthn'} disabled={busy === 'pin'}
            onClick={() => void run('webauthn')}>
            Use a passkey
          </Button>
        </Group>
      )}
      {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
      {notEnrolled && (
        <Text fz="sm" role="alert">
          That factor is not set up. <Anchor component={Link} to="/app/security">Add it on the security page</Anchor>.
        </Text>
      )}
    </Stack>
  );
}

export function SecondFactor() {
  const nav = useNavigate();
  const [factors] = useState(loadFactors);
  return (
    <Stack maw={420}>
      <Title order={1}>Second step</Title>
      <Text c="dimmed" fz="sm">Your password was right. Now prove it is you with a factor auth-gate holds.</Text>
      <FactorForm
        factors={factors}
        start={(factor) => api<Challenge>('/api/auth/second-factor/start', { body: { factor } })}
        verify={(challengeId, proof) => api('/api/auth/second-factor/verify', { body: { challengeId, ...proof } })}
        onDone={() => nav('/app/home')}
      />
      <Anchor component={Link} to="/app/login" fz="sm">Start over</Anchor>
    </Stack>
  );
}
