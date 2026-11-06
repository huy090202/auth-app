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
import { useStrings } from './strings';

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
  const t = useStrings();
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    nav('/app/login');
  };
  return (
    <div className="app-stage">
      <div className="app-column">
        <nav className="app-nav" aria-label={t.navLabel}>
          <NavLink to="/app/home" className="nav-link">{t.navHome}</NavLink>
          <NavLink to="/app/security" className="nav-link">{t.navSecurity}</NavLink>
          <Button size="compact-sm" variant="subtle" color="gray" ml="auto" onClick={() => void logout()}>{t.signOut}</Button>
        </nav>
        {children}
      </div>
    </div>
  );
}

/** Routes under /app/*. */
export function DemoRoutes() {
  const t = useStrings();
  return (
    <Routes>
      <Route index element={<Navigate to="login" replace />} />
      <Route path="register" element={<AuthScreen title={t.titleRegister}><Register /></AuthScreen>} />
      <Route path="login" element={<AuthScreen title={t.titleLogin}><Login /></AuthScreen>} />
      <Route path="login/second-factor" element={<AuthScreen title={t.titleSecondStep}><SecondFactor /></AuthScreen>} />
      <Route path="login/passkey" element={<AuthScreen title={t.titlePasskeyLogin}><PasskeyLogin /></AuthScreen>} />
      <Route path="home" element={<SessionGuard>{(s) => <SignedIn title={t.navHome}><Home {...s} /></SignedIn>}</SessionGuard>} />
      <Route path="security" element={<SessionGuard>{(s) => <SignedIn title={t.navSecurity}><Security {...s} /></SignedIn>}</SessionGuard>} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}
