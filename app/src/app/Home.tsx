import { Anchor, Button, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError, api } from '../lib/api';
import { describe, type Me } from './session';
import { StepUpModal } from './StepUpModal';
import { useStrings } from './strings';

export function Home({ me, reload }: { me: Me; reload: () => Promise<void> }) {
  const t = useStrings();
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
      setNotice(t.emailChanged);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'step_up_required' ? t.verifyExpired : describe(e, t));
    }
  };

  const keys = me.factors.webauthn.length;
  const factors = [me.factors.pin && 'PIN', keys > 0 && t.passkeyCount(keys)].filter(Boolean).join(' · ') || t.factorsNone;

  return (
    <Stack gap="md">
      <div className="page-head">
        <Title order={1}>{t.hello(me.username)}</Title>
        <Text c="dimmed" fz="sm">{t.homeIntro}</Text>
      </div>
      <section className="panel glass">
        <div className="field-row">
          <div className="field-meta">
            <Text fz="xs" c="dimmed">{t.email}</Text>
            {editing ? (
              <form onSubmit={ask} className="panel-form-inline">
                <TextInput aria-label={t.newEmail} type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required autoFocus style={{ flex: 1, minWidth: 200 }} />
                <Group gap="xs">
                  <Button variant="subtle" color="gray" onClick={() => { setEditing(false); setEmail(me.email); }}>{t.cancel}</Button>
                  <Button type="submit">{t.save}</Button>
                </Group>
              </form>
            ) : (
              <Text truncate>{me.email}</Text>
            )}
          </div>
          {!editing && <Button size="sm" variant="light" onClick={() => { setNotice(''); setEditing(true); }}>{t.change}</Button>}
        </div>
        <div className="field-row">
          <div className="field-meta">
            <Text fz="xs" c="dimmed">{t.secondFactors}</Text>
            <Text>{factors}</Text>
          </div>
          <Anchor component={Link} to="/app/security" fz="sm" fw={600}>{t.manage}</Anchor>
        </div>
        {error && <Text c="red.7" fz="sm" mt="sm" role="alert">{error}</Text>}
        {notice && <Text c="var(--accent-text)" fz="sm" mt="sm" role="status">{notice}</Text>}
      </section>
      <StepUpModal opened={stepUp} purpose="change-email" factors={me.factors} onClose={() => setStepUp(false)} onToken={(t) => void apply(t)} />
    </Stack>
  );
}
