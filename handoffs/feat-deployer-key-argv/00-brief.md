# Brief: feat/deployer-key-argv (repository huy090202/auth-app)

## Goal
Stop `scripts/setup-and-deploy/00-deployer.sh` putting the deployer's AWS secret access key on
argv. Line 49 runs `aws configure set aws_secret_access_key "$secret" --profile "$USER_NAME"`, so
the key is visible in `ps` while that command runs.

## Constraints
- The secret must reach the `auth-app-deployer` profile without being an argument to any process.
  Candidates: `aws configure import --csv file://<0600 temp file>`, or a section written to the
  shared credentials file from a shell builtin. Choose one, and confirm how it behaves with
  aws-cli 2 before relying on it.
- Keep behaviour: the profile ends up with key id, secret, `region` and `output`; an already
  configured profile still exits early without creating another key; other profiles in the
  credentials file are untouched; the secret is never printed.
- Honour `AWS_SHARED_CREDENTIALS_FILE` if you write the file yourself, and leave it mode 0600.
- Any temp file holding the secret is 0600 and removed on exit, including on failure.
- If configuring the profile fails after `create-access-key`, the key exists in IAM but the secret
  is lost. Say so in the error, without the secret, and name the recovery step.
- Do not run it against real AWS. It would create a real access key. Test with a stub for the
  `iam` and `sts` calls and a sandbox `AWS_SHARED_CREDENTIALS_FILE` and `AWS_CONFIG_FILE`.
- The change is this one script. Report anything else in the handoff.

## Definition of done
- With stubs and an argv recorder, a run shows that the fake secret appears in no process argument,
  and that the sandbox profile resolves to the right key id, secret, region and output, read back
  with `aws configure get`. The same argv check fails on the old script.
- A second profile already in the sandbox file is unchanged, and a rerun creates no second key.
- `bash -n` passes on the script, plus `shellcheck` if it is installed. `pnpm run check` green.
- Branch pushed, and the human reminded to open the PR. Do not run `merge.sh` unless asked.
- Handoff written with an empty "Remaining".

## References
- Script: `scripts/setup-and-deploy/00-deployer.sh:41-52`
- Found in: `orchestrator:handoffs/feat-register-key-argv/2026-11-07-1312.md`
