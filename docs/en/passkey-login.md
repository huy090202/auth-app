---
title: Passkey-only login
tryIt: /app/login/passkey
---
# Passkey-only login

No password. The user types a username, you look it up and challenge their passkey.
auth-gate v1 has no discoverable credentials, so the username is required.

```text
browser          backend                          auth-gate
  │ username ─────► look up user, GET /api/factors/{subjectId}
  │                 POST /api/challenges {subjectId, purpose: "login", factor: "webauthn"}
  │ ◄── publicKey ◄── {challengeId, publicKey}
  │ navigator.credentials.get(...)
  │ credential ───► POST /api/challenges/{id}/verify {credential}
  │                 ◄── {token}; verify it, full session
  │ ◄── done
```

Don't leak which usernames exist. In `bff`, an unknown username and a user with no
passkey get the same answer, `409 factor_not_enrolled`:

```ts
const notEnrolled = () => c.json({ error: 'factor_not_enrolled' }, 409);
if (!user) return notEnrolled();
const f = await authGate.factors(c.var.trace, user.userId);
if (f.webauthn.length === 0) return notEnrolled();
const ch = await authGate.createChallenge(c.var.trace, user.userId, 'login', 'webauthn');
```

On verify there is no session yet, so take `sub` from the token, still verify it
fully (signature, `iss`, `aud`, `exp`, `purpose: "login"`), then check the user
exists on your side.

Browser (`app/src/lib/webauthn.ts`):

```ts
export function toRequestOptions(publicKey: unknown): PublicKeyCredentialRequestOptions {
  const pk = publicKey as Record<string, unknown> & { challenge: string; allowCredentials?: Desc[] };
  return {
    ...pk,
    challenge: fromB64url(pk.challenge),
    allowCredentials: descs(pk.allowCredentials),
  } as PublicKeyCredentialRequestOptions;
}
```
