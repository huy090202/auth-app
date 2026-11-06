import { Anchor, Button, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
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

  const keys = me.factors.webauthn.length;
  const factors = [me.factors.pin && 'PIN', keys > 0 && `${keys} passkey${keys > 1 ? 's' : ''}`].filter(Boolean).join(' · ') || 'None yet';

  return (
    <Stack gap="md">
      <div className="page-head">
        <Title order={1}>Hello, {me.username}</Title>
        <Text c="dimmed" fz="sm">You are fully signed in. Changing your email asks you to verify again.</Text>
      </div>
      <section className="panel glass">
        <div className="field-row">
          <div className="field-meta">
            <Text fz="xs" c="dimmed">Email</Text>
            {editing ? (
              <form onSubmit={ask} className="panel-form-inline">
                <TextInput aria-label="New email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required autoFocus style={{ flex: 1, minWidth: 200 }} />
                <Group gap="xs">
                  <Button variant="subtle" color="gray" onClick={() => { setEditing(false); setEmail(me.email); }}>Cancel</Button>
                  <Button type="submit">Save</Button>
                </Group>
              </form>
            ) : (
              <Text truncate>{me.email}</Text>
            )}
          </div>
          {!editing && <Button size="sm" variant="light" onClick={() => { setNotice(''); setEditing(true); }}>Change</Button>}
        </div>
        <div className="field-row">
          <div className="field-meta">
            <Text fz="xs" c="dimmed">Second factors</Text>
            <Text>{factors}</Text>
          </div>
          <Anchor component={Link} to="/app/security" fz="sm" fw={600}>Manage</Anchor>
        </div>
        {error && <Text c="red.7" fz="sm" mt="sm" role="alert">{error}</Text>}
        {notice && <Text c="var(--accent-text)" fz="sm" mt="sm" role="status">{notice}</Text>}
      </section>
      <StepUpModal opened={stepUp} purpose="change-email" factors={me.factors} onClose={() => setStepUp(false)} onToken={(t) => void apply(t)} />
    </Stack>
  );
}
