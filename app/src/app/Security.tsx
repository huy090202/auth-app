import { Badge, Button, Group, PasswordInput, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../lib/api';
import { monoFont } from '../theme';
import { serializeCredential, toCreationOptions } from '../lib/webauthn';
import { describe, isCancelled, type Me } from './session';

const day = (s: string) => new Date(s).toLocaleDateString(undefined, { dateStyle: 'medium' });

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8m-3 3 3 3" />
    </svg>
  );
}

function PinSection({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    setEditing(false);
    setPin('');
    setAgain('');
    setError('');
  };

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    if (pin !== again) return setError('The two PINs do not match.');
    setBusy(true);
    try {
      await api('/api/me/pin', { body: { pin } });
      close();
      await reload();
    } catch (e) {
      setError(e instanceof ApiError && (e.code === 'pin_rejected' || e.code === 'invalid_pin') ? 'auth-gate rejected that PIN.' : describe(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/api/me/pin', { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const showForm = editing || !me.factors.pin;
  return (
    <section className="panel glass">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="xs">
          <Title order={2}>PIN</Title>
          {me.factors.pin ? <Badge variant="light" size="sm">Set</Badge> : <Badge variant="default" size="sm">Not set</Badge>}
        </Group>
        {!showForm && <Button variant="light" size="sm" onClick={() => setEditing(true)}>Change PIN</Button>}
      </Group>
      <Text fz="sm" c="dimmed" mt={6}>
        {me.factors.pin ? 'Asked after your password, and before sensitive actions.' : 'Add a PIN to use it after your password and before sensitive actions.'}
      </Text>
      {showForm && (
        <form onSubmit={save} className="panel-form">
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
            <PasswordInput label="New PIN" value={pin} onChange={(e) => setPin(e.currentTarget.value)} required inputMode="numeric" autoComplete="new-password" />
            <PasswordInput label="Repeat PIN" value={again} onChange={(e) => setAgain(e.currentTarget.value)} required inputMode="numeric" autoComplete="new-password" />
          </SimpleGrid>
          <Group justify="flex-end" gap="xs" mt="md">
            {me.factors.pin && <Button variant="subtle" color="gray" onClick={close} disabled={busy}>Cancel</Button>}
            <Button type="submit" loading={busy}>{me.factors.pin ? 'Save PIN' : 'Set PIN'}</Button>
          </Group>
        </form>
      )}
      {!showForm && (
        <Group mt="sm">
          <Button variant="subtle" color="red" size="compact-sm" className="flush" onClick={() => void remove()} disabled={busy}>Remove PIN</Button>
        </Group>
      )}
      {error && <Text c="red.7" fz="sm" mt="sm" role="alert">{error}</Text>}
    </section>
  );
}

function PasskeySection({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const reg = await api<{ registrationId: string; publicKey: unknown }>('/api/me/passkeys/start', { body: { displayName: me.username } });
      const cred = (await navigator.credentials.create({ publicKey: toCreationOptions(reg.publicKey) })) as PublicKeyCredential | null;
      if (!cred) return;
      await api('/api/me/passkeys/finish', { body: { registrationId: reg.registrationId, credential: serializeCredential(cred) } });
      await reload();
    } catch (e) {
      if (isCancelled(e)) return;
      setError(e instanceof ApiError && e.code === 'registration_failed' ? 'Could not register this passkey' : describe(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/me/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const keys = me.factors.webauthn;
  return (
    <section className="panel glass">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="xs">
          <Title order={2}>Passkeys</Title>
          {keys.length > 0 && <Badge variant="light" size="sm">{keys.length}</Badge>}
        </Group>
        <Button variant="light" size="sm" onClick={() => void add()} loading={busy}>Add a passkey</Button>
      </Group>
      {keys.length === 0 ? (
        <Text fz="sm" c="dimmed" mt={6}>Sign in with your fingerprint, face or security key instead of a PIN.</Text>
      ) : (
        <ul className="key-list">
          {keys.map((k) => (
            <li key={k.credentialId}>
              <span className="key-icon"><KeyIcon /></span>
              <div className="key-meta">
                <Text fz="sm" ff={monoFont} truncate title={k.credentialId}>{k.credentialId.slice(0, 12)}…</Text>
                <Text fz="xs" c="dimmed">
                  Added {day(k.createdAt)} · {k.lastUsedAt ? `Last used ${day(k.lastUsedAt)}` : 'Never used'}
                </Text>
              </div>
              <Button size="compact-sm" variant="subtle" color="red" disabled={busy} aria-label={`Remove passkey ${k.credentialId.slice(0, 12)}`} onClick={() => void remove(k.credentialId)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      {error && <Text c="red.7" fz="sm" mt="sm" role="alert">{error}</Text>}
    </section>
  );
}

export function Security({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  return (
    <Stack gap="md">
      <div className="page-head">
        <Title order={1}>Security</Title>
        <Text c="dimmed" fz="sm">Your second factors live in auth-gate, not in this app. Add one, then sign out and back in to try it.</Text>
      </div>
      <PinSection me={me} reload={reload} />
      <PasskeySection me={me} reload={reload} />
    </Stack>
  );
}
