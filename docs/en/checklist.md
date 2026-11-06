---
title: Integration checklist
---
# Integration checklist

Work through these in order. Each step depends on the one before it.

## 1. Get your credentials

Choose your `rpId` and `origins`, then request a client. You get a base URL, a `clientId`
and an `accessKey`. See [Get your credentials](/docs/setup).

## 2. Add the AuthGate call to your backend

Keep the key on your backend and add one helper that sends it. Add routes of your own for
the browser to call, because the browser never calls AuthGate. See
[Call AuthGate](/docs/setup#call-authgate).

Choose your `subjectId`: a stable user id from your system, not the username, using letters,
digits, `-` and `_`, at most 64 bytes.

## 3. Add token verification

Add it before any flow, so no flow can ship without it. See
[Verify the token](/docs/verify-token).

## 4. Let users enroll a factor

Add a PIN form, a passkey button, or both, to a signed-in settings page. A user needs a factor
before you can challenge them. See [Enroll a PIN or passkey](/docs/enroll).

## 5. Build the flows you need

| You want | Build |
|---|---|
| A second step after the password | [2FA after password](/docs/2fa-login) |
| Login with no password | [Passkey-only login](/docs/passkey-login) |
| A fresh check before a sensitive action | [Step-up](/docs/step-up) |

Pick a `purpose` string for each action, such as `login` or `change-email`. Your backend
chooses it, and the token repeats it.

## 6. Handle errors

Handle at least a wrong PIN, a lockout and an expired challenge. See [Errors](/docs/errors).

## 7. Check before going live

- Each environment has its own client, with HTTPS origins in production.
- The `accessKey` is in a secret store and never reaches the browser or your logs.
- PINs and passkey responses are left out of your request logs.
- `subjectId` always comes from your session or user lookup, never from the request.
- Every token is checked for signature, `iss`, `aud`, `exp`, `purpose` and, where you
  know the user, `sub`.
- Adding, changing or removing a factor needs a full session, plus a step-up if the user already
  has a factor.
- Your own endpoints are rate limited.
- You have a recovery process for users who lose their factor.
- Deleting a user also removes their factors. See
  [List and remove factors](/docs/enroll#list-and-remove-factors).
