---
title: Errors
---
# Errors

auth-gate answers with a status and `{error}`. `bff` maps them like this, and you
probably want the same:

| auth-gate | bff | What to show |
|---|---|---|
| 400 `verification_failed` + `attemptsRemaining` | 400 same, keeps `attemptsRemaining` | "Wrong PIN, N attempts left" |
| 423 `locked` + `lockedUntil` | 423 same | disable the form, show when it unlocks |
| 410 `challenge_gone` | 410 same | "Expired, try again", start a new challenge |
| 404 `factor_not_found` | 409 `factor_not_enrolled` | link to the security page to enroll |
| 400 `registration_failed` | 400 same | "Could not register this passkey" |
| 5xx or network | 502 `authgate_unavailable` | a generic notice; don't show upstream detail |

A few notes:

- A challenge is single use and short-lived. After `410`, start over; don't retry
  the verify.
- `404 factor_not_found` becomes `409` because from your user's point of view nothing
  is missing on the server; they just haven't set the factor up.
- On passkey-only login, an unknown username also gets `409 factor_not_enrolled`, so
  usernames can't be probed.
- A token that fails verification is your call: `bff` returns `401 unauthorized` on
  login and `403 step_up_required` on a step-up action.
