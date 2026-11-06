---
title: API reference
---
# API reference

These are the calls your backend makes. Creating clients and issuing keys is handled by the
operator and isn't part of this API. See [Get your credentials](/docs/setup).

## Conventions

- **Base URL:** `https://<authgate-host>`, which you get with your credentials.
- **Auth:** send `x-internal-access-key: <accessKey>` on every call except the public key set.
  Without a valid key, the answer is `401 {"error":"unauthorized"}`.
- **Bodies:** JSON, at most 1 MiB. Unknown fields are ignored.
- **Ids:** `subjectId`, `purpose` and ids in paths are 1 to 256 bytes with no `#`. Anything else
  gets `400 invalid_id`. A `subjectId` used with passkeys must be at most 64 bytes, or registration
  also answers `400 invalid_id`. Prefer letters, digits, `-` and `_` for `subjectId`, and encode ids when
  you put them in a URL.
- **Times:** RFC 3339 strings, in UTC.
- **Rate limit:** every call with a valid key counts toward your client's limit. Over it, any of
  these calls can answer `429 {"error":"rate_limited"}` with `Retry-After` in whole seconds. The
  public key set isn't limited.
- **Errors:** a status plus `{"error": "<code>"}`. Any call can also answer `500 internal`. Each
  code is explained in [Errors](/docs/errors).

## Factors

### POST /api/factors/pin

Sets or replaces the subject's PIN and clears any lockout.

- **Request:** `{subjectId, pin}`
- **Success:** `201 {}`
- **Errors:** `invalid_json`, `invalid_id`, `pin_rejected`

### DELETE /api/factors/pin/{subjectId}

Removes the subject's PIN.

- **Success:** `204`, also when there was no PIN
- **Errors:** `invalid_id`

### GET /api/factors/{subjectId}

Lists what the subject has enrolled. An unknown subject gets `pin: false` and an empty list.

- **Success:** `200`

```json
{
  "pin": true,
  "webauthn": [
    { "credentialId": "base64url", "createdAt": "2026-11-06T10:00:00Z", "lastUsedAt": null }
  ]
}
```

- **Errors:** `invalid_id`

## Passkey registration

### POST /api/webauthn/registrations

Starts a registration, valid for five minutes.

- **Request:** `{subjectId, displayName?}`. `displayName` defaults to `subjectId`, and `subjectId`
  is sent to the browser as `user.name` either way.
- **Success:** `201 {registrationId, publicKey}`. `publicKey` holds the options for
  `navigator.credentials.create`, with binary values as base64url. The subject's existing
  passkeys are in `excludeCredentials`.
- **Errors:** `invalid_json`, `invalid_id`

### POST /api/webauthn/registrations/{registrationId}

Finishes a registration. The first call with a well-formed body uses it up, even if it fails.

- **Request:** `{credential}`, the browser's response with binary values as base64url
- **Success:** `201 {credentialId}`
- **Errors:** `invalid_json`, `invalid_id`, `registration_failed`, `challenge_gone`

### DELETE /api/webauthn/credentials/{credentialId}?subjectId={subjectId}

Removes one passkey. `subjectId` is required.

- **Success:** `204`, also when there was no such passkey
- **Errors:** `invalid_id`

## Challenges

### POST /api/challenges

Opens a single-use challenge, valid for five minutes.

- **Request:** `{subjectId, purpose, factor}`. `factor` is `pin` or `webauthn`.
- **Success:** `201 {challengeId, expiresAt, publicKey?}`. `publicKey` is present only for
  `webauthn` and holds the options for `navigator.credentials.get`, with binary values as
  base64url.
- **Errors:** `invalid_json`, `invalid_id`, `wrong_factor`, `factor_not_found`, `locked`

### POST /api/challenges/{challengeId}/verify

Checks the answer and, if it is right, issues a token. A PIN challenge allows `maxAttempts` from
your PIN policy, and a passkey challenge allows three attempts.

- **Request:** exactly one of `{pin}` and `{credential}`
- **Success:** `200 {token, expiresAt, factor}`. See [Verify the token](/docs/verify-token).
- **Errors:** `invalid_json`, `invalid_id`, `verification_failed`, `wrong_factor`,
  `factor_not_found`, `locked`, `challenge_gone`

## Public keys

### GET /.well-known/jwks.json

The keys that verify tokens. No credential needed.

- **Success:** `200 {keys: [...]}`, with `Cache-Control: public, max-age=300`. Each key has `kty`
  `EC`, `crv` `P-256`, `alg` `ES256`, `use` `sig`, `kid`, `x` and `y`.
