import { Anchor, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { saveFactors, type LoginFactors } from './SecondFactor';
import { describe } from './session';
import { useStrings } from './strings';

type LoginReply = { next: 'done' } | { next: 'second-factor'; factors: LoginFactors };

export function Login() {
  const nav = useNavigate();
  const t = useStrings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<LoginReply>('/api/auth/login', { body: { username, password } });
      if (r.next === 'done') {
        nav('/app/home');
      } else {
        saveFactors(r.factors);
        nav('/app/login/second-factor');
      }
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'invalid_credentials' ? t.loginWrong : describe(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack maw={360}>
      <Title order={1}>{t.loginTitle}</Title>
      <form onSubmit={submit}>
        <Stack>
          <TextInput label={t.username} value={username} onChange={(e) => setUsername(e.currentTarget.value)} required autoComplete="username" />
          <PasswordInput label={t.password} value={password} onChange={(e) => setPassword(e.currentTarget.value)} required autoComplete="current-password" />
          {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
          <Button type="submit" loading={busy}>{t.continue}</Button>
        </Stack>
      </form>
      <Stack gap={4} fz="sm">
        <Anchor component={Link} to="/app/login/passkey" fz="sm">{t.loginWithPasskey}</Anchor>
        <Anchor component={Link} to="/app/register" fz="sm">{t.createAccount}</Anchor>
      </Stack>
    </Stack>
  );
}
