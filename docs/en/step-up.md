---
title: Step-up before a sensitive action
tryIt: /app/home
---
# Step-up before a sensitive action

The user is logged in, but changing their email should need a fresh check. Same
challenge, with a `purpose` that names the action.

```text
browser               backend                        auth-gate
  │ start ─────────────► POST /api/challenges {subjectId, purpose: "change-email", factor}
  │ pin | credential ──► POST /api/challenges/{id}/verify
  │ ◄── stepUpToken ◄─── {token}; verify it
  │ new email + stepUpToken ──► verify again, sub + purpose, then update
```

**Why the token travels with the action.** The token proves one verification, for one
subject, for one purpose. If you verify it and then set `steppedUp = true` in the
session, you have thrown that away: the flag works for any action, for as long as the
session lives. So hand the token to the frontend and make it send the token with the
request that does the thing. The action's handler verifies it right there:

```ts
await verifyAuthGateToken(typeof b.stepUpToken === 'string' ? b.stepUpToken : '', {
  jwks,
  issuer: config.authGateBaseUrl,
  audience: config.authGateClientId,
  subject: userId,
  purpose: 'change-email',
});
```

Only start step-ups for purposes you know (`bff` keeps an allow-list), so a made-up
purpose never reaches AuthGate.

In v1 a replayed token is accepted until `exp`. If that matters to you, track `jti`
and refuse a token you have already seen.
