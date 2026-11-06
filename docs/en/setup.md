---
title: Register your backend
---
# Register your backend

Your backend is a *client* of AuthGate. Register it once with the admin key. You get
back a `clientId` and an `accessKey`. The key is shown once: store it as a secret
straight away. If you lose it, rotate it with `POST /api/clients/{id}/keys`.

`rpId` and `origins` are for passkeys: the domain the browser sees, and the exact
origins your pages are served from. Get them wrong and every WebAuthn call fails.

In this repo it is one script:

```bash
AUTHGATE_BASE_URL=https://auth-gate.example.com AUTHGATE_ADMIN_KEY=... \
  scripts/setup-and-deploy/02-register-client.sh local   # or: stg
```

The `curl` behind it (secrets go through files, never argv):

```bash
printf 'x-internal-access-key: %s\n' "$AUTHGATE_ADMIN_KEY" >"$tmpdir/headers"
jq -n --arg name "$name" --arg rp "$rp_id" --arg origin "$origin" \
  '{name: $name, rpId: $rp, origins: [$origin]}' >"$tmpdir/body"
status="$(curl -sS -o "$tmpdir/resp" -w '%{http_code}' -X POST "$base/api/clients" \
  -H @"$tmpdir/headers" -H 'content-type: application/json' \
  --data-binary @"$tmpdir/body")" || die "POST $base/api/clients: network error"
```

Expect `201` with `{clientId, accessKey}`. From then on every call your backend makes
sends `x-internal-access-key: <accessKey>`, and the tokens you get carry
`aud = clientId`.
