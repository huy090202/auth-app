---
title: 2FA after password
tryIt: /app/login
---
# 2FA after password

You check the password. If the user has a factor, you give them a half session that can only
do the second step, then ask AuthGate.

```text
browser              your backend                     AuthGate
  │ user + password ───► check password
  │                      GET /api/factors/{subjectId}
  │                      ◄── {pin, webauthn}
  │ ◄── which factors ── half session
  │ chosen factor ─────► POST /api/challenges {subjectId, purpose: "login", factor}
  │                      ◄── {challengeId, expiresAt, publicKey?}
  │ ◄── publicKey? ───── keep challengeId in the half session
  │ pin | credential ──► POST /api/challenges/{challengeId}/verify {pin | credential}
  │                      ◄── {token, expiresAt, factor}
  │                      verify the token, full session
  │ ◄── done
```

## Your backend

Open the challenge. `publicKey` is present only when `factor` is `webauthn`.

```ts
const { status, data } = await authGate('POST', '/api/challenges', {
  subjectId: user.id,
  purpose: 'login',
  factor, // 'pin' or 'webauthn'
});
// Keep data.challengeId in the half session, send data.publicKey to the browser.
```

Relay the answer, verify the token, then replace the half session with a full one:

```ts
const proof = pin !== undefined ? { pin } : { credential };
const { status, data } = await authGate(
  'POST',
  `/api/challenges/${halfSession.challengeId}/verify`,
  proof,
);
if (status === 200) {
  await verifyAuthGateToken(data.token, { subject: user.id, purpose: 'login' });
  // Start the full session.
}
```

Send exactly one of `pin` and `credential`. See [Verify the token](/docs/verify-token) for
`verifyAuthGateToken`.

Keep `challengeId` on your side. AuthGate ties a challenge to your client, not to a browser,
so if you take it from the request, one user could answer another user's challenge. The `sub`
check would reject the token, but the `200` or `400` would still show whether a PIN guess was right,
and wrong guesses would count toward the other user's lockout.

## The browser

For a PIN, send `{ pin }` to your backend. For a passkey, using the functions from
[Convert WebAuthn data](/docs/enroll#convert-webauthn-data):

```ts
const cred = (await navigator.credentials.get({
  publicKey: toRequestOptions(publicKey),
})) as PublicKeyCredential;
const credential = serializeCredential(cred);
// Send credential to your backend.
```

## When it fails

- `400 verification_failed`: wrong answer. Ask again on the same challenge, or open a new one when
  `attemptsRemaining` is 0.
- `423 locked`: too many wrong PINs. Show `lockedUntil`.
- `410 challenge_gone`: expired, used or out of attempts. Open a new challenge.

See [Errors](/docs/errors) for the full list.
