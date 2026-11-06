---
title: Enroll a PIN or passkey
tryIt: /app/security
---
# Enroll a PIN or passkey

A user needs a factor before you can challenge them. `subjectId` is your user id, and it must
stay stable, so don't use the username. Stick to letters, digits, `-` and `_`, at most 64 bytes.
AuthGate accepts up to 256 bytes with no `#`, but passkey registration answers `400 invalid_id`
above 64. The id also reaches the browser and can appear in the passkey prompt, so keep anything
private out of it.

Enroll only for a signed-in user, and take `subjectId` from your session, never from the
request. Enrolling a PIN replaces the old one and clears any lockout, so if the user already
has a factor, [step up](/docs/step-up) first.

## PIN

```ts
const { status } = await authGate('POST', '/api/factors/pin', { subjectId: user.id, pin });
```

Expect `201`. A PIN must have exactly the policy's length and contain only digits. A repeated
digit (`111111`) or a straight run (`123456`, `654321`) gets `400 pin_rejected`.

## Passkey

Two calls, with the browser in between:

```text
browser              your backend                  AuthGate
  │ add passkey ───────► POST /api/webauthn/registrations {subjectId, displayName?}
  │                      ◄── {registrationId, publicKey}
  │ ◄── publicKey ─────  keep registrationId
  │ navigator.credentials.create(...)
  │ credential ────────► POST /api/webauthn/registrations/{registrationId} {credential}
  │                      ◄── {credentialId}
  │ ◄── done
```

Backend:

```ts
const begin = await authGate('POST', '/api/webauthn/registrations', {
  subjectId: user.id,
  displayName: user.email, // optional, defaults to subjectId
});
// Keep begin.data.registrationId in your session, send begin.data.publicKey to the browser.

const finish = await authGate('POST', `/api/webauthn/registrations/${registrationId}`, { credential });
```

Browser, using the functions in the next section:

```ts
const cred = (await navigator.credentials.create({
  publicKey: toCreationOptions(publicKey),
})) as PublicKeyCredential;
const credential = serializeCredential(cred);
// Send credential to your backend.
```

A registration lasts five minutes and is used up by the first finish call with a well-formed
body, even if that call fails. After `400 registration_failed` or `410 challenge_gone`, start again.

## Convert WebAuthn data

AuthGate sends and expects base64url strings, but the browser API uses `ArrayBuffer`s. Copy
these functions into your frontend. Passkey login and step-up use them too.

```ts
export function fromB64url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function toB64url(buf: ArrayBuffer): string {
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Desc = { id: string; type: string; transports?: string[] };
const descs = (list?: Desc[]) =>
  list?.map((d) => ({ ...d, id: fromB64url(d.id) }) as PublicKeyCredentialDescriptor);

export function toCreationOptions(publicKey: any): PublicKeyCredentialCreationOptions {
  return {
    ...publicKey,
    challenge: fromB64url(publicKey.challenge),
    user: { ...publicKey.user, id: fromB64url(publicKey.user.id) },
    excludeCredentials: descs(publicKey.excludeCredentials),
  };
}

export function toRequestOptions(publicKey: any): PublicKeyCredentialRequestOptions {
  return {
    ...publicKey,
    challenge: fromB64url(publicKey.challenge),
    allowCredentials: descs(publicKey.allowCredentials),
  };
}

export function serializeCredential(cred: PublicKeyCredential) {
  const r = cred.response as any;
  const response: Record<string, unknown> = { clientDataJSON: toB64url(r.clientDataJSON) };
  if (r.attestationObject) {
    response.attestationObject = toB64url(r.attestationObject);
    response.transports = r.getTransports?.();
  } else {
    response.authenticatorData = toB64url(r.authenticatorData);
    response.signature = toB64url(r.signature);
    response.userHandle = r.userHandle ? toB64url(r.userHandle) : null;
  }
  return {
    id: cred.id,
    rawId: toB64url(cred.rawId),
    type: cred.type,
    response,
    clientExtensionResults: cred.getClientExtensionResults(),
  };
}
```

## List and remove factors

| Call | Result |
|---|---|
| `GET /api/factors/{subjectId}` | `200 {pin, webauthn: [{credentialId, createdAt, lastUsedAt}]}` |
| `DELETE /api/factors/pin/{subjectId}` | `204`, also when there was no PIN |
| `DELETE /api/webauthn/credentials/{credentialId}?subjectId={subjectId}` | `204`, also when there was no such passkey |

An unknown subject isn't an error: the list answers `{pin: false, webauthn: []}`. Encode ids
with `encodeURIComponent` when you put them in a path or query.

When you delete a user, list their factors and remove each one, because AuthGate doesn't know
your users are gone.
