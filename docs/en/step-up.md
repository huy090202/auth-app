---
title: Step-up before a sensitive action
tryIt: /app/home
---
# Step-up before a sensitive action

The user is logged in, but changing their email should need a fresh check. It is the same
challenge as login, with a `purpose` that names the action.

```text
browser                 your backend                      AuthGate
  │ start ───────────────► POST /api/challenges {subjectId, purpose: "change-email", factor}
  │                        ◄── {challengeId, expiresAt, publicKey?}
  │ ◄── publicKey? ─────── keep challengeId in the session
  │ pin | credential ────► POST /api/challenges/{challengeId}/verify {pin | credential}
  │                        ◄── {token, expiresAt, factor}
  │ ◄── token ───────────
  │ new email + token ───► verify the token (sub, purpose), then update
  │ ◄── done
```

Open and answer the challenge as in [2FA after password](/docs/2fa-login), with the action as
the `purpose`. The difference is what happens to the token.

## Why the token travels with the action

The token proves one verification, for one subject, for one purpose. If you verify it and then
set `steppedUp = true` in the session, you throw that away: the flag works for any action, for
as long as the session lives.

So hand the token to the frontend and have it send the token with the request that does the
thing. The action's handler verifies it right there:

```ts
await verifyAuthGateToken(body.stepUpToken, {
  subject: session.userId,
  purpose: 'change-email',
});
// It passed: change the email.
```

See [Verify the token](/docs/verify-token) for `verifyAuthGateToken`.

## Choosing purposes

`purpose` is a string you choose, 1 to 256 bytes with no `#`. Use one per action, because a
token for `transfer` must not authorise `change-email`.

Have your backend set the purpose for each route, or check it against a fixed list. Never pass
it straight from the request.

## Factors and passkeys

If an action accepts only certain factors, check the token's `amr`, because the browser picks the
factor in this flow. AuthGate also doesn't require user verification, so a security key that only
needs a touch passes a passkey step-up.

## Single use

A token can be replayed until it expires. If that matters for an action, store each `jti` until
its `exp` and refuse any you have already seen.
