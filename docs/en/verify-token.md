---
title: Verify the token
---
# Verify the token

Never trust a token because it came back from AuthGate over your own connection.
Check it. This file (`bff/src/authgate/token.ts`) has no dependency on the rest of
`bff`; copy it. It needs `jose`.

```ts
export function remoteJwks(baseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL('/.well-known/jwks.json', baseUrl), {
    cooldownDuration: 300_000,
    cacheMaxAge: 300_000,
  });
}

/** Verify an auth-gate token (login or step-up). Any failure throws TokenRejectedError. */
export async function verifyAuthGateToken(
  token: string,
  opts: { jwks: JWTVerifyGetKey; issuer: string; audience: string; subject: string; purpose: string },
): Promise<AuthGateClaims> {
  try {
    const { payload } = await jwtVerify(token, opts.jwks, {
      algorithms: ['ES256'],
      issuer: opts.issuer,
      audience: opts.audience,
    });
    if (payload.sub !== opts.subject || payload.purpose !== opts.purpose) {
      throw new Error('claim mismatch');
    }
    return payload as unknown as AuthGateClaims;
  } catch {
    throw new TokenRejectedError();
  }
}
```

Every failure throws `TokenRejectedError`, with no detail. Map it to your own error:
`bff` answers `401` on login and `403 step_up_required` on step-up.

| Claim | Check |
|---|---|
| signature | ES256, key from `<AUTHGATE_BASE_URL>/.well-known/jwks.json` (cached 5 min) |
| `iss` | equals your `AUTHGATE_BASE_URL` |
| `aud` | equals your `clientId` |
| `exp` | in the future (`jose` does this) |
| `sub` | the user you expect |
| `purpose` | the action you expect (`login`, `change-email`, ...) |
| `jti` | unique id; track it if you need single use |
