# Brief: feat/register-key-argv (repository huy090202/auth-app)

## Goal
Stop `scripts/setup-and-deploy/02-register-client.sh` putting the just-issued client key on
`jq`'s argv. On the stg path, lines 82-83 pass it with `--arg v "$access_key"`, so it is visible
in `ps` while `jq` runs. This breaks the script's own rule at line 50: "Secrets go through 0600
temp files, never argv."

## Constraints
- Build the parameter file from the response file, so the key is never an argument:

  ```bash
  jq --arg n "$PARAM_PREFIX/authgate-client-key" \
    '{Name: $n, Type: "SecureString", Value: .accessKey}' "$tmpdir/resp" >"$tmpdir/param"
  ```

- Keep the rest of the script's behaviour: the local `.env` path, the validation at line 66,
  and the failure message when `put-parameter` fails.
- Do not run it against real auth-gate or AWS. It would register a real client. Test with stub
  `curl` and `aws` on `PATH`.
- The change is this one script. If you find another secret on argv, report it in the handoff
  rather than widening the branch.

## Definition of done
- With stubs and a `jq` wrapper that records its arguments, a stg-path run shows that the fake
  key appears in no `jq` argument, and that the parameter file holds the right `Name`, `Type`
  and `Value`. The same check fails on the old script.
- `bash -n` passes on the script, plus `shellcheck` if it is installed. `pnpm run check` green.
- Branch pushed, and the human reminded to open the PR. Do not run `merge.sh` unless asked.
- Handoff written with an empty "Remaining".

## References
- Script: `scripts/setup-and-deploy/02-register-client.sh:64-66`, `:82-84`
- Same fix in auth-gate: `scripts/console/register-client.sh` on its branch `feat/admin`, read only
