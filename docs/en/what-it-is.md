---
title: What AuthGate is
---
# What AuthGate is

AuthGate checks a second factor for your users: a PIN or a passkey. You ask it to
start a challenge, relay the user's answer, and get back a short-lived signed token
that says "this subject passed this factor for this purpose". You verify the token
and decide what it unlocks.

It does not know your users, passwords or sessions. Your backend owns all of that and
is the only thing that talks to AuthGate. The browser never does.

```text
browser ──► your backend ──► auth-gate
   │             │  POST /api/challenges            {subjectId, purpose, factor}
   │             │  POST /api/challenges/{id}/verify {pin | credential}
   │             ◄── token (ES256 JWT: sub, aud, purpose, amr, jti, exp)
   ◄── your session / your action
```

This site is two things: these pages, and a demo app whose backend (`bff`) is a
working client you can copy from. Every "Try it" opens the demo with a trace panel
showing the exact calls `bff` made to AuthGate. The trace is a demo feature. Do not
ship it in a real client.
