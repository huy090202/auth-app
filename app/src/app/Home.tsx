import { Button, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { ApiError, api } from '../lib/api';
import { describe, type Me } from './session';
import { StepUpModal } from './StepUpModal';

export function Home({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(me.email);
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const ask = (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    setStepUp(true);
  };

  const apply = async (stepUpToken: string) => {
    setStepUp(false);
    try {
      await api('/api/me/email', { body: { email, stepUpToken } });
      setEditing(false);
      setNotice('Email changed.');
      await reload();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'step_up_required' ? 'Verification expired, try again' : describe(e));
    }
  };

  return (
    <Stack maw={480}>
      <Title order={1}>Hello, {me.username}</Title>
      <Text c="dimmed" fz="sm">You are fully signed in. Changing your email asks you to verify again.</Text>
      {editing ? (
        <form onSubmit={ask}>
          <Group align="flex-end">
            <TextInput label="New email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required w={260} />
            <Button type="submit">Save</Button>
            <Button variant="subtle" onClick={() => { setEditing(false); setEmail(me.email); }}>Cancel</Button>
          </Group>
        </form>
      ) : (
        <Group style={{ borderTop: '1px solid var(--mantine-color-default-border)', borderBottom: '1px solid var(--mantine-color-default-border)' }} py="sm" justify="space-between">
          <Text>
            <Text span c="dimmed" fz="sm">Email </Text>
            {me.email}
          </Text>
          <Button size="xs" variant="default" onClick={() => { setNotice(''); setEditing(true); }}>Change</Button>
        </Group>
      )}
      {error && <Text c="red.7" fz="sm" role="alert">{error}</Text>}
      {notice && <Text fz="sm" role="status">{notice}</Text>}
      <StepUpModal opened={stepUp} purpose="change-email" factors={me.factors} onClose={() => setStepUp(false)} onToken={(t) => void apply(t)} />
    </Stack>
  );
}
