---
title: Passkey-only login
tryIt: /app/login/passkey
---
# Passkey-only login

No password. The user types a username, you look it up and challenge their passkey. AuthGate
v1 has no discoverable credentials, so the username is required.

```text
browser          your backend                       AuthGate
  │ username ───────► look up the user
  │                   POST /api/challenges {subjectId, purpose: "login", factor: "webauthn"}
  │                   ◄── {challengeId, expiresAt, publicKey}
  │ ◄── publicKey ─── keep challengeId
  │ navigator.credentials.get(...)
  │ credential ─────► POST /api/challenges/{challengeId}/verify {credential}
  │                   ◄── {token, expiresAt, factor}
  │                   verify the token, take sub, start the session
  │ ◄── done
```

## Your backend

Open the challenge. Give an unknown username and a user with no passkey the same answer, so
that nobody can use this endpoint to learn which usernames exist.

```ts
const user = await findUserByUsername(username);
if (!user) return notEnrolledResponse();

const begin = await authGate('POST', '/api/challenges', {
  subjectId: user.id,
  purpose: 'login',
  factor: 'webauthn',
});
if (begin.status === 404) return notEnrolledResponse(); // factor_not_found
if (begin.status !== 201) return errorResponse();
// Keep begin.data.challengeId in a short-lived pre-login session, send begin.data.publicKey to the browser.
```

This doesn't hide everything: a user who has a passkey still gets options back, so a caller
can tell that account has one. Rate limit this endpoint.

Verify the answer. The user isn't logged in yet, so read `challengeId` from the pre-login session,
take the user from the token's `sub`, still check everything else, then confirm the user exists on
your side:

```ts
const { status, data } = await authGate('POST', `/api/challenges/${challengeId}/verify`, { credential });
if (status === 200) {
  const claims = await verifyAuthGateToken(data.token, { purpose: 'login' });
  const user = await findUserById(claims.sub!);
  // No user: refuse. Otherwise start the session.
}
```

See [Verify the token](/docs/verify-token) for `verifyAuthGateToken`.

## The browser

Using the functions from [Convert WebAuthn data](/docs/enroll#convert-webauthn-data):

```ts
const cred = (await navigator.credentials.get({
  publicKey: toRequestOptions(publicKey),
})) as PublicKeyCredential;
const credential = serializeCredential(cred);
// Send credential to your backend.
```

## How strong this is

AuthGate doesn't require user verification. Most passkeys ask for a biometric or device PIN, but a
security key that only needs a touch also passes, and the token doesn't say which happened. Weigh
that up before you make a passkey the only thing protecting an account.

## When it fails

- `400 verification_failed`: the assertion didn't verify. A passkey challenge allows three
  attempts, so open a new one when `attemptsRemaining` is 0.
- `410 challenge_gone`: expired, used or out of attempts. Open a new challenge.

See [Errors](/docs/errors) for the full list.
