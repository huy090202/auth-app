---
title: What you get
---
# What you get

AuthGate checks a second factor for your users: a PIN or a passkey. Your backend opens a
challenge, passes on the user's answer, and gets back a short-lived signed token that says
"this user passed this factor for this purpose". You verify the token and decide what it
unlocks.

```text
browser ──► your backend ──► AuthGate
                 │  POST /api/challenges             {subjectId, purpose, factor}
                 │  POST /api/challenges/{id}/verify {pin | credential}
                 │◄── token (ES256 JWT: sub, aud, purpose, amr, jti, exp)
browser ◄── your session or your action
```

## What AuthGate provides

- **PINs:** hashed storage, a length policy, rejection of trivial PINs, and a lockout after
  repeated failures.
- **Passkeys:** the WebAuthn options for the browser, and verification of what comes back,
  including the `rpId` and origin.
- **Challenges:** single use, valid for five minutes, and visible only to your client.
- **Tokens:** ES256 JWTs valid for 5 minutes by default (15 at most), plus a public key set
  to verify them.

## What stays with you

- **Users, passwords and sessions.** AuthGate only knows the opaque `subjectId` you give it.
- **A backend that makes every call.** Browsers never call AuthGate.
- **Every screen:** the PIN form, the passkey prompt, and the settings page.
- **Verifying each token** and deciding what it allows.
- **Deciding when to ask:** which actions need a check and which factors you accept.
- **Recovery.** AuthGate has no reset flow. If a user loses a factor, you confirm who they
  are your own way, then enroll a new one.
- **Everything around the check:** emails, your audit log, and limits on your own endpoints.

AuthGate v1 has no discoverable credentials, so passkey login needs a username first.

## Next

Follow the [integration checklist](/docs/checklist).

Some pages end with a **Try it** button. It opens a demo that runs the flow and shows the
calls made to AuthGate. It is optional, and nothing here depends on it.
