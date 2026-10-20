import { Anchor, Button, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError, api } from '../lib/api';
import { describe } from './session';

export function Register() {
  const nav = useNavigate();
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
      setError(e instanceof ApiError && e.code === 'username_taken' ? 'That username is taken.' : describe(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack maw={360}>
      <Title order={1}>Create an account</Title>
      <Text c="dimmed" fz="sm">
        The account lives in this app. auth-gate only holds the second factors you add next.
      </Text>
      <form onSubmit={submit}>
        <Stack>
          <TextInput label="Username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} required autoComplete="username" />
          <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required autoComplete="email" />
          <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} required autoComplete="new-password" />
          {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
          <Button type="submit" loading={busy}>Create account</Button>
        </Stack>
      </form>
      <Text fz="sm">
        Already have one? <Anchor component={Link} to="/app/login">Sign in</Anchor>
      </Text>
    </Stack>
  );
}
