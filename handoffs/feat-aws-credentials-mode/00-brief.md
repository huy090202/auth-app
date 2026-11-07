# Brief: feat/aws-credentials-mode (for orchestrator analysis, not yet assigned)

Decide this before running `new.sh`. The outcome may need no branch at all, because the problem is
on this machine and not in the repository. The name is a placeholder.

## Goal
Decide what to do about the AWS credentials on this machine being open to every local user, then
either assign the fix or record why it is accepted.

Found while working on `feat/deployer-key-argv`. It was not caused by that change.

## What is known (2026-11-07)
- `~/.aws` is a symlink to `/mnt/c/Users/tay09/.aws`, on a 9p drvfs mount with no `metadata` option.
- `~/.aws`, `credentials` and `config` all show mode 777.
- `/etc/wsl.conf` has no `[automount]` section. `AWS_SHARED_CREDENTIALS_FILE` and `AWS_CONFIG_FILE`
  are not set in the session environment.
- The AWS CLI writes this file for any tool, so `00-deployer.sh` asking for 0600 cannot help here.
  A new file created through the CLI on a normal Linux filesystem does get 0600.
- `ongdev2k2` is the only WSL account with a login shell, which limits the practical exposure.
  System service accounts and Windows-side access were not assessed.

## Not verified
- Which profiles the file holds. The contents were deliberately not read. `ADMIN_PROFILE=default` in
  the docs suggests an admin key may be there, as well as `auth-app-deployer`.
- Whether `chmod` has any effect on this mount, or what the Windows ACLs on the folder allow.
- Whether anything on the Windows side uses this folder, such as a Windows AWS CLI or an IDE.
- There is no evidence that any key was exposed. Nothing here suggests a compromise.

## Options to weigh
1. Move the files to the Linux filesystem (a real `~/.aws`, mode 700 and 600). Simplest, but stops
   sharing with Windows tools, if any use it.
2. Add `options = "metadata"` under `[automount]` in `/etc/wsl.conf`, then `chmod`. Needs
   `wsl --shutdown` and changes every Windows mount, so it can affect other work.
3. Keep the files in place and point `AWS_SHARED_CREDENTIALS_FILE` and `AWS_CONFIG_FILE` at a Linux
   copy. Leaves a second copy to keep in sync, and the old one to delete.
4. Accept it for a single-user machine, and write down why.

Also decide whether the repository should do anything, such as a setup note in `docs/` or a warning
in `scripts/setup-and-deploy/`, or whether this stays a machine matter. auth-gate may share these
credentials, so check it too.

## Constraints
- Ask the human before changing anything on this machine. Options 1 to 3 touch real credentials and
  system configuration outside the repository, and the orchestrator does not change those itself.
- Do not print or read credential values. File names and modes are enough.
- Back up before moving or deleting the files. Losing an access key's secret means issuing a new one.
- A profile must still resolve after any change, checked with a harmless local command such as
  `aws configure list --profile <name>`, which masks the secret.

## Definition of done
- The human has picked an option, and the reason is recorded in this folder.
- If the fix needs repository changes: a normal assignment with its own brief, and `pnpm run check`
  green on that branch.
- If the fix is on the machine only: it is applied by or with the human, `stat` shows the new modes,
  the profiles still resolve, and the BOARD row is set to `abandoned` with a note saying that no
  branch was needed.
- If accepted as is: the reason is recorded, and the row is set to `abandoned` with that note.

## References
- `handoffs/feat-deployer-key-argv/2026-11-07-1405.md`, under "Decisions and gotchas"
- `scripts/setup-and-deploy/00-deployer.sh`
