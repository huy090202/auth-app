import { Anchor, Modal, Stack, Text } from '@mantine/core';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { FactorForm } from './SecondFactor';
import type { Me } from './session';
import { useStrings } from './strings';

type StepUp = { stepUpToken: string; expiresAt: string };

/** Verify once more for one purpose; hands the stepUpToken back to the caller. */
export function StepUpModal({ opened, purpose, factors, onClose, onToken }: {
  opened: boolean;
  purpose: 'change-email';
  factors: Me['factors'];
  onClose: () => void;
  onToken: (token: string) => void;
}) {
  const t = useStrings();
  const available = { pin: factors.pin, webauthn: factors.webauthn.length > 0 };
  return (
    <Modal opened={opened} onClose={onClose} title={t.stepUpTitle} centered>
      <Stack>
        <Text fz="sm" c="dimmed">
          {t.stepUpIntro} <code>{purpose}</code> {t.stepUpIntroEnd}
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
            {t.noFactorYet} <Anchor component={Link} to="/app/security">{t.addPinOrPasskey}</Anchor> {t.first}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
