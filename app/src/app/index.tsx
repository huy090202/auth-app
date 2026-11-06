import { Button } from '@mantine/core';
import type { ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router';
import { demoTitle, useTitle } from '../brand';
import { api } from '../lib/api';
import { Home } from './Home';
import { Login } from './Login';
import { PasskeyLogin } from './PasskeyLogin';
import { Register } from './Register';
import { SecondFactor } from './SecondFactor';
import { Security } from './Security';
import { SessionGuard } from './session';

/** Signed-out screens: one glass card centred in the viewport. */
function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  useTitle(demoTitle(title));
  return (
    <div className="auth-stage">
      <div className="auth-card glass">{children}</div>
    </div>
  );
}

function SignedIn({ title, children }: { title: string; children: ReactNode }) {
  useTitle(demoTitle(title));
  const nav = useNavigate();
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    nav('/app/login');
  };
  return (
    <div className="app-stage">
      <div className="app-column">
        <nav className="app-nav" aria-label="Account">
          <NavLink to="/app/home" className="nav-link">Home</NavLink>
          <NavLink to="/app/security" className="nav-link">Security</NavLink>
          <Button size="compact-sm" variant="subtle" color="gray" ml="auto" onClick={() => void logout()}>Sign out</Button>
        </nav>
        {children}
      </div>
    </div>
  );
}

/** Routes under /app/*. */
export function DemoRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="login" replace />} />
      <Route path="register" element={<AuthScreen title="Create an account"><Register /></AuthScreen>} />
      <Route path="login" element={<AuthScreen title="Sign in"><Login /></AuthScreen>} />
      <Route path="login/second-factor" element={<AuthScreen title="Second step"><SecondFactor /></AuthScreen>} />
      <Route path="login/passkey" element={<AuthScreen title="Passkey sign-in"><PasskeyLogin /></AuthScreen>} />
      <Route path="home" element={<SessionGuard>{(s) => <SignedIn title="Home"><Home {...s} /></SignedIn>}</SessionGuard>} />
      <Route path="security" element={<SessionGuard>{(s) => <SignedIn title="Security"><Security {...s} /></SignedIn>}</SessionGuard>} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}
