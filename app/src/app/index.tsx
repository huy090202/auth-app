import { Anchor, Button, Group, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { Home } from './Home';
import { Login } from './Login';
import { PasskeyLogin } from './PasskeyLogin';
import { Register } from './Register';
import { SecondFactor } from './SecondFactor';
import { Security } from './Security';
import { SessionGuard } from './session';

function SignedIn({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    nav('/app/login');
  };
  return (
    <Stack gap="lg">
      <Group gap="lg" pb="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Anchor component={Link} to="/app/home" fz="sm">Home</Anchor>
        <Anchor component={Link} to="/app/security" fz="sm">Security</Anchor>
        <Button size="compact-sm" variant="subtle" ml="auto" onClick={() => void logout()}>Sign out</Button>
      </Group>
      {children}
    </Stack>
  );
}

/** Routes under /app/*. */
export function DemoRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="login" replace />} />
      <Route path="register" element={<Register />} />
      <Route path="login" element={<Login />} />
      <Route path="login/second-factor" element={<SecondFactor />} />
      <Route path="login/passkey" element={<PasskeyLogin />} />
      <Route path="home" element={<SessionGuard>{(s) => <SignedIn><Home {...s} /></SignedIn>}</SessionGuard>} />
      <Route path="security" element={<SessionGuard>{(s) => <SignedIn><Security {...s} /></SignedIn>}</SessionGuard>} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}
