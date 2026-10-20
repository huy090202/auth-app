---
title: Enroll a PIN or passkey
tryIt: /app/security
---
# Enroll a PIN or passkey

A user needs a factor before you can challenge it. `subjectId` is your user id; pick
something stable that is not the username.

**PIN** is one call: `POST /api/factors/pin` with `{subjectId, pin}`. Remove it with
`DELETE /api/factors/pin/{subjectId}`.

**Passkey** is two calls with the browser in between:

```text
browser          backend                       auth-gate
  │ add passkey ──► POST /api/webauthn/registrations {subjectId}
  │ ◄── publicKey ◄── {registrationId, publicKey}
  │ navigator.credentials.create(...)
  │ credential ───► POST /api/webauthn/registrations/{id} {credential}
  │                 ◄── {credentialId}
```

The options come as JSON with base64url strings; WebAuthn wants `ArrayBuffer`s. This
is the whole conversion (`app/src/lib/webauthn.ts`):

```ts
export function fromB64url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
```

`toCreationOptions` decodes `challenge`, `user.id` and `excludeCredentials`;
`serializeCredential` encodes the result back. List factors with
`GET /api/factors/{subjectId}`.
