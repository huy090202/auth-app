import { Button, Group, PasswordInput, Stack, Table, Text, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../lib/api';
import { monoFont } from '../theme';
import { serializeCredential, toCreationOptions } from '../lib/webauthn';
import { describe, isCancelled, type Me } from './session';

const rule = { borderTop: '1px solid var(--mantine-color-default-border)' };
const when = (s?: string) => (s ? new Date(s).toLocaleString() : 'never');

function PinSection({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    if (pin !== again) return setError('The two PINs do not match.');
    setBusy(true);
    try {
      await api('/api/me/pin', { body: { pin } });
      setPin('');
      setAgain('');
      await reload();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'invalid_pin' ? 'auth-gate rejected that PIN.' : describe(e));
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

  return (
    <Stack style={rule} pt="md">
      <Title order={2}>PIN</Title>
      <Text fz="sm" c="dimmed">{me.factors.pin ? 'A PIN is set. Setting a new one replaces it.' : 'No PIN yet.'}</Text>
      <form onSubmit={save}>
        <Group align="flex-end">
          <PasswordInput label="New PIN" value={pin} onChange={(e) => setPin(e.currentTarget.value)} required inputMode="numeric" w={160} />
          <PasswordInput label="Repeat PIN" value={again} onChange={(e) => setAgain(e.currentTarget.value)} required inputMode="numeric" w={160} />
          <Button type="submit" loading={busy}>Set PIN</Button>
          {me.factors.pin && <Button variant="default" onClick={() => void remove()} disabled={busy}>Remove PIN</Button>}
        </Group>
      </form>
      {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
    </Stack>
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
    <Stack style={rule} pt="md">
      <Group justify="space-between">
        <Title order={2}>Passkeys</Title>
        <Button onClick={() => void add()} loading={busy}>Add a passkey</Button>
      </Group>
      {keys.length === 0 ? (
        <Text fz="sm" c="dimmed">No passkeys yet.</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr><Table.Th>Credential</Table.Th><Table.Th>Added</Table.Th><Table.Th>Last used</Table.Th><Table.Th /></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {keys.map((k) => (
              <Table.Tr key={k.credentialId}>
                <Table.Td ff={monoFont} fz="xs">{k.credentialId.slice(0, 12)}…</Table.Td>
                <Table.Td fz="sm">{when(k.createdAt)}</Table.Td>
                <Table.Td fz="sm">{when(k.lastUsedAt)}</Table.Td>
                <Table.Td><Button size="compact-xs" variant="subtle" color="red" disabled={busy} onClick={() => void remove(k.credentialId)}>Remove</Button></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
    </Stack>
  );
}

export function Security({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  return (
    <Stack maw={640} gap="lg">
      <Title order={1}>Security</Title>
      <Text c="dimmed" fz="sm">Second factors are stored in auth-gate, not in this app. Add one, then sign out and back in.</Text>
      <PinSection me={me} reload={reload} />
      <PasskeySection me={me} reload={reload} />
    </Stack>
  );
}
