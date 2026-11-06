import { Anchor, Button, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { serializeCredential, toRequestOptions } from '../lib/webauthn';
import { describe, isCancelled } from './session';
import { useStrings } from './strings';

export function PasskeyLogin() {
  const nav = useNavigate();
  const t = useStrings();
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
      else if (e instanceof ApiError && e.code === 'challenge_gone') setError(t.expiredTryAgain);
      else setError(describe(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack maw={360}>
      <Title order={1}>{t.passkeyLoginTitle}</Title>
      <Text c="dimmed" fz="sm">{t.passkeyLoginIntro}</Text>
      <form onSubmit={submit}>
        <Stack>
          <TextInput label={t.username} value={username} onChange={(e) => setUsername(e.currentTarget.value)} required autoComplete="username webauthn" />
          {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
          {notEnrolled && (
            <Text fz="sm" role="alert">
              {t.passkeyNone} <Anchor component={Link} to="/app/login">{t.passkeySignInPassword}</Anchor> {t.passkeyAndAddOne}
            </Text>
          )}
          <Button type="submit" loading={busy}>{t.continue}</Button>
        </Stack>
      </form>
      <Anchor component={Link} to="/app/login" fz="sm">{t.usePassword}</Anchor>
    </Stack>
  );
}
