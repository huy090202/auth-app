import { Anchor, Modal, Stack, Text } from '@mantine/core';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { FactorForm } from './SecondFactor';
import type { Me } from './session';

type StepUp = { stepUpToken: string; expiresAt: string };

/** Verify once more for one purpose; hands the stepUpToken back to the caller. */
export function StepUpModal({ opened, purpose, factors, onClose, onToken }: {
  opened: boolean;
  purpose: 'change-email';
  factors: Me['factors'];
  onClose: () => void;
  onToken: (token: string) => void;
}) {
  const available = { pin: factors.pin, webauthn: factors.webauthn.length > 0 };
  return (
    <Modal opened={opened} onClose={onClose} title="Confirm it is you" centered>
      <Stack>
        <Text fz="sm" c="dimmed">
          This action needs a fresh verification. The token it returns is good for <code>{purpose}</code> only.
        </Text>
        {available.pin || available.webauthn ? (
          <FactorForm
            factors={available}
            start={(factor) => api('/api/stepup/start', { body: { purpose, factor } })}
            verify={(challengeId, proof) => api<StepUp>('/api/stepup/verify', { body: { challengeId, ...proof } })}
            onDone={(r) => onToken(r.stepUpToken)}
          />
        ) : (
          <Text fz="sm">
            You have no second factor yet. <Anchor component={Link} to="/app/security">Add a PIN or a passkey</Anchor> first.
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
