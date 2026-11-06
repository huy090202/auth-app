---
title: Get your credentials
---
# Get your credentials

Your backend is a *client* of AuthGate. Each client has its own key, users and settings.

## Request a client

The team that operates your AuthGate creates clients. Send them these values:

| Field | Required | Rules |
|---|---|---|
| `name` | yes | Your app's name. Browsers may show it in the passkey prompt. |
| `rpId` | yes | The domain passkeys belong to, such as `example.com`. Use `localhost` for local development. |
| `origins` | yes | Every origin your pages are served from, such as `https://app.example.com`: scheme, host and optional port, no path. Each host must be the `rpId` or a subdomain of it. |
| `pinPolicy.length` | no | 4 to 8 digits. Default 6. |
| `pinPolicy.maxAttempts` | no | 1 to 10 failures before a lockout. Default 5. |
| `pinPolicy.lockoutSec` | no | 1 to 86400 seconds. Default 900. |
| `tokenTtlSec` | no | Token lifetime, 1 to 900 seconds. Default 300. |

Choose `rpId` with care. Passkeys are bound to it, so moving to another domain means every
user enrolls again. If `rpId` or `origins` don't match the page, passkey calls fail.

List every origin you will need up front, and talk to the operator before you need a change.
A user's factors belong to one client, so moving to a replacement client means every user enrolls
again.

Use one client per environment. Local, staging and production have different origins, and
this keeps their users and keys apart.

## What you get back

- **Base URL:** the address your backend calls, written as `https://<authgate-host>` in these
  docs.
- **`clientId`:** tokens issued for you carry it as `aud`.
- **`accessKey`:** a secret starting with `ag_`. It is shown only once, so put it in your
  secret store straight away.

## Call AuthGate

Every call except the public key set sends the key in `x-internal-access-key`. One helper is
enough, and the flow pages use this one:

```ts
const AUTHGATE_URL = process.env.AUTHGATE_URL!;
const ACCESS_KEY = process.env.AUTHGATE_ACCESS_KEY!;

export async function authGate(method: string, path: string, body?: unknown) {
  const res = await fetch(AUTHGATE_URL + path, {
    method,
    headers: { 'x-internal-access-key': ACCESS_KEY, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
```

A missing or wrong key gets `401 {"error":"unauthorized"}`, with no detail about why. A brief
`401` with a key you know is right can come from a failure on AuthGate's side, so retry before
asking for a new key.

## Rotate the key

The operator issues new keys. The new key works at once, and the previous one keeps working
for 24 hours so you can redeploy without downtime.

That also means rotating alone doesn't stop a leaked key. If your key leaks, tell the operator
immediately. The operator can:

- **Replace the key now:** issue a new key, then end the previous key's 24 hours at once. Your
  backend gets `401` until you deploy the new key.
- **Disable your client:** all of its keys stop at once and get the same `401` as a wrong key, until
  the operator enables the client again.

Either way, tokens already issued stay valid until they expire, 15 minutes at most.
