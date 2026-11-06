import { Anchor, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { describe } from './session';
import { useStrings } from './strings';

export function Register() {
  const nav = useNavigate();
  const t = useStrings();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/register', { body: { username, password, email } });
      // A new account has no second factor, so login finishes in one step.
      await api('/api/auth/login', { body: { username, password } });
      nav('/app/security');
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'username_taken' ? t.registerTaken : describe(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack maw={360}>
      <Title order={1}>{t.registerTitle}</Title>
      <Text c="dimmed" fz="sm">
        {t.registerIntro}
      </Text>
      <form onSubmit={submit}>
        <Stack>
          <TextInput label={t.username} value={username} onChange={(e) => setUsername(e.currentTarget.value)} required autoComplete="username" />
          <TextInput label={t.email} type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required autoComplete="email" />
          <PasswordInput label={t.password} value={password} onChange={(e) => setPassword(e.currentTarget.value)} required autoComplete="new-password" />
          {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
          <Button type="submit" loading={busy}>{t.registerSubmit}</Button>
        </Stack>
      </form>
      <Text fz="sm">
        {t.haveAccount} <Anchor component={Link} to="/app/login">{t.signIn}</Anchor>
      </Text>
    </Stack>
  );
}
