---
title: 2FA after password
tryIt: /app/login
---
# 2FA after password

You check the password. If the user has a factor, give them a half session that can
only do the second step, then ask AuthGate.

```text
browser            backend                          auth-gate
  │ user + password ──► check password, half session
  │ factor=pin ───────► POST /api/challenges {subjectId, purpose: "login", factor}
  │ ◄── challengeId ◄── {challengeId, expiresAt, publicKey?}
  │ pin | credential ─► POST /api/challenges/{id}/verify
  │                   ◄── {token, expiresAt, factor}
  │                     verify token, full session
  │ ◄── done
```

Backend: relay, then verify the token before you trust it (`bff/src/routes/auth.ts`):

```ts
const v = await authGate.verifyChallenge(c.var.trace, challengeId, parseProof(b));
await verifyLoginToken(v.token, userId);
await issueSession(c, secret, { userId, mfa: true });
```

The relay itself is one `fetch` with your client key (`bff/src/authgate/client.ts`):

```ts
res = await this.fetchFn(`${this.baseUrl}${path}`, {
  method,
  headers: {
    'x-internal-access-key': this.clientKey,
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
```

Browser, for a passkey (`app/src/app/SecondFactor.tsx`, codec from `webauthn.ts`):

```ts
const cred = (await navigator.credentials.get({ publicKey: toRequestOptions(ch.publicKey) })) as PublicKeyCredential | null;
```

then send `{ credential: serializeCredential(cred) }`. For a PIN, send `{ pin }`.
