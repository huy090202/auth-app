---
title: Verify the token
---
# Verify the token

Never trust a token because it came back from AuthGate over your own connection. Check it every
time, including when the browser hands it back to you for a step-up.

This sample uses [`jose`](https://github.com/panva/jose) and has no other dependency. In another
language, use a JOSE library and make the same checks.

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const AUTHGATE_URL = process.env.AUTHGATE_URL!; // https://<authgate-host>, no trailing slash
const CLIENT_ID = process.env.AUTHGATE_CLIENT_ID!;

const jwks = createRemoteJWKSet(new URL('/.well-known/jwks.json', AUTHGATE_URL), {
  cacheMaxAge: 300_000,
});

/** Throws if the token is not valid for this purpose and, when given, this subject. */
export async function verifyAuthGateToken(
  token: string,
  expected: { purpose: string; subject?: string },
) {
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ['ES256'],
    issuer: AUTHGATE_URL,
    audience: CLIENT_ID,
    subject: expected.subject,
    requiredClaims: ['exp', 'sub'],
  });
  if (payload.purpose !== expected.purpose) throw new Error('wrong purpose');
  return payload;
}
```

Any failure throws. Turn that into your own error, and don't tell the caller which check failed.

## What to check

| Item | Check |
|---|---|
| signature | ES256, using the key from `<base URL>/.well-known/jwks.json` whose `kid` matches the token header |
| `iss` | equals your base URL, such as `https://<authgate-host>` |
| `aud` | equals your `clientId` |
| `exp` | in the future |
| `sub` | the user you expect, if you know them. On passkey-only login, this is how you learn who it is. |
| `purpose` | the action you are about to allow |

Three more claims are there if you need them:

| Claim | Meaning |
|---|---|
| `amr` | `["pin"]` or `["webauthn"]`: which factor was used. Check it if an action accepts only certain factors. |
| `iat` | when the token was issued |
| `jti` | the challenge id, unique per token. Track it if you need [single use](/docs/step-up#single-use). |

## Keys change

Pick the key by `kid` on each verification, and don't pin a key in your code. The key set can
hold more than one key during a signing-key rotation. It may be cached for 300 seconds, and the
`jose` key set above handles caching and unknown `kid`s for you.
