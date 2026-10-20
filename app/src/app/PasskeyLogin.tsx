import { Anchor, Button, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { serializeCredential, toRequestOptions } from '../lib/webauthn';
import { describe, isCancelled } from './session';

export function PasskeyLogin() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notEnrolled, setNotEnrolled] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError('');
    setNotEnrolled(false);
    try {
      const ch = await api<{ challengeId: string; publicKey: unknown }>('/api/auth/passkey/start', { body: { username } });
      const cred = (await navigator.credentials.get({ publicKey: toRequestOptions(ch.publicKey) })) as PublicKeyCredential | null;
      if (!cred) return;
      await api('/api/auth/passkey/verify', { body: { challengeId: ch.challengeId, credential: serializeCredential(cred) } });
      nav('/app/home');
    } catch (e) {
      if (isCancelled(e)) return;
      if (e instanceof ApiError && e.code === 'factor_not_enrolled') setNotEnrolled(true);
      else if (e instanceof ApiError && e.code === 'challenge_gone') setError('Expired, try again.');
      else setError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack maw={360}>
      <Title order={1}>Sign in with a passkey</Title>
      <Text c="dimmed" fz="sm">No password. auth-gate v1 needs the username to find your passkeys.</Text>
      <form onSubmit={submit}>
        <Stack>
          <TextInput label="Username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} required autoComplete="username webauthn" />
          {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
          {notEnrolled && (
            <Text fz="sm" role="alert">
              No passkey for that username. <Anchor component={Link} to="/app/login">Sign in with your password</Anchor> and add one.
            </Text>
          )}
          <Button type="submit" loading={busy}>Continue</Button>
        </Stack>
      </form>
      <Anchor component={Link} to="/app/login" fz="sm">Use a password instead</Anchor>
    </Stack>
  );
}
