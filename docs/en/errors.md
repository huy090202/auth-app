---
title: Errors
---
# Errors

AuthGate answers with a status and `{"error": "<code>"}`. Your backend decides what the user sees,
so don't pass these responses straight through.

## Errors your users can cause

| Status and code | What happened | What to do |
|---|---|---|
| `400 verification_failed` + `attemptsRemaining` | Wrong PIN, or a passkey answer that didn't verify. | Ask again on the same challenge and show the attempts left. At `0`, open a new challenge. |
| `423 locked` + `lockedUntil` | Too many wrong PINs for this subject. | Disable the form and show when it unlocks. |
| `410 challenge_gone` | The challenge or registration expired, was used, ran out of attempts, or isn't yours. | Don't retry the call. Start a new one. |
| `400 pin_rejected` | A new PIN breaks the policy: wrong length, not all digits, a repeated digit, or a straight run. | Ask for a different PIN. |
| `404 factor_not_found` | The subject has no factor of this kind. | Offer another factor. Offer enrollment only in a full session, after a step-up if the user has any factor. Otherwise someone who only knows the password can enroll their own PIN and pass 2FA. On passkey-only login, use the same answer you give an unknown username. |
| `400 registration_failed` | The passkey response didn't verify, often because `rpId` or `origins` don't match the page. | Start the registration again. |
| `429 rate_limited` + `Retry-After` | Your client went over its rate limit. The limit covers all your calls together, not each user. | Ask the user to try again shortly. Wait at least `Retry-After` seconds before repeating the call. |

## Errors that mean a bug or a setup problem

| Status and code | What happened | What to do |
|---|---|---|
| `401 unauthorized` | The key is missing, wrong or past its 24-hour grace period, or AuthGate couldn't look it up. The body never says which. | Check your configured key. If it is right, retry before asking for a new one. |
| `400 invalid_json` | The body isn't valid JSON, has a field of the wrong type or is over 1 MiB, is missing `credential` on a finish call, or doesn't send exactly one of `pin` and `credential` on a verify call. | Fix the request. |
| `400 invalid_id` | `subjectId` or `purpose` is missing or empty, an id is over 256 bytes or contains `#`, or the `subjectId` of a passkey registration is over 64 bytes. | Fix the request. |
| `400 wrong_factor` | `factor` isn't `pin` or `webauthn`, or the verify body doesn't match the challenge's factor. A mismatch uses up an attempt. | Fix the request. |

## Errors on AuthGate's side

| Status | What happened | What to do |
|---|---|---|
| `500 internal`, other 5xx, or a network error | AuthGate couldn't complete the call. | Show a generic notice, with no upstream detail. If it happened on a verify call, open a new challenge. |

## Details worth knowing

- **Failures count per subject.** Opening a new challenge doesn't reset a PIN's failure count, and
  `attemptsRemaining` only counts this challenge. After a new challenge, the lockout can come sooner
  than that number suggests, so don't present it as a guarantee.
- **A lockout ends in two ways:** when `lockedUntil` passes, or when you enroll a new PIN. Enrolling
  clears it, so [protect that route](/docs/enroll).
- **A correct PIN resets the failure count.**
- **Passkeys don't lock.** The third failure on a passkey challenge answers `400` with
  `attemptsRemaining: 0`, and any later call answers `410`.
- **A `subjectId` over 64 bytes can't have a passkey.** Starting the registration answers
  `400 invalid_id`, even though the same id works for a PIN. See [Enroll a PIN or passkey](/docs/enroll).
- **A `429` changes nothing.** AuthGate rejects the call before running it, so it doesn't use up a PIN
  attempt or a registration, and a challenge stays open until it expires. After `Retry-After`, a whole
  number of seconds, repeat the same call.
- **A token that fails verification is yours to handle.** AuthGate isn't involved at that point. Use
  your own `401` or `403`.
