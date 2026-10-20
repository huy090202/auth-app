# Worktree lifecycle

## Why

A feature goes through the same five steps every time: assign, build, hand off, merge,
remove. Doing them by hand invites small mistakes: a worktree without `local/`, a
forgotten `pnpm install`, a merge that skips the gate, a branch left on the remote, a
dangling Claude link. Each risky step is therefore a script in `main/tools/wt/`, and each
script refuses to run when its preconditions fail.

The orchestrator session prints the commands; the human pastes them. Claude never runs
the scripts itself, so the human sees and approves every change to the workspace.

## How

All commands below run from a worktree folder (usually `orchestrator/`). Scripts are
called through the `main` worktree: `../main/tools/wt/<script>`. Each script finds the
workspace root by walking up from the current directory (then from its own location)
until it finds a folder containing `.bare`.

### The walkthrough

Example feature: `feat/pin`, folder `feat-pin/`.

1. **Assign.** In the orchestrator session, the human says what to build. Claude adds a
   BOARD row with status `planned`, writes `handoffs/feat-pin/00-brief.md`, commits both
   on `orchestrator`, and prints:

   ```bash
   ../main/tools/wt/new.sh feat/pin
   cd ../feat-pin && claude
   ```

   `new.sh` creates the branch from `origin/main`, the worktree, the `local` symlink,
   runs `pnpm install`, links the Claude project directory, and prints
   `cd <root>/feat-pin && claude`.

2. **Build.** `claude` starts in `feat-pin/`. The `SessionStart` hook prints the BOARD row
   for `feat-pin` and the newest file in `../orchestrator/handoffs/feat-pin/` (the brief
   the first time). The session works under `CLAUDE.md` and, if present,
   `local/rules.md`. It commits on `feat/pin` when asked.

3. **Hand off.** When the work is done, or when the context guard warns, run `/handoff`.
   It writes `../orchestrator/handoffs/feat-pin/<yyyy-mm-dd-hhmm>.md`, sets the BOARD row
   status (`active` while work remains, `review` when done) and the Last handoff column,
   commits on `orchestrator`, and ends with `cd <root>/feat-pin && claude`. If work
   remains, start a new session with that command and go back to step 2.

4. **Merge.** In the orchestrator session, the human says the feature is done. Claude
   reads the newest handoff, checks the row says `review`, and prints:

   ```bash
   ../main/tools/wt/merge.sh feat/pin
   ```

   The script rebases `feat/pin` on an up-to-date `main`, runs the gate inside
   `feat-pin/`, merges it into `main` with a merge commit, and pushes `main`. On any failure it stops and says
   what failed. Nothing is force-pushed.

5. **Remove.** After the human confirms the merge passed, Claude prints:

   ```bash
   ../main/tools/wt/rm.sh feat/pin
   ```

   The script refuses unless `feat/pin` is merged into `main`. It removes the worktree,
   the local branch, the remote branch and the Claude project symlink. Claude then sets
   the row to `merged` and commits on `orchestrator`.

A feature that is dropped instead: `rm.sh feat/pin --force`, and the row becomes
`abandoned`.

### Scripts and flags

All scripts are `bash` with `set -euo pipefail`. They print each step as `==> ...`,
warnings as `warn: ...` and fatal errors as `error: ...` (exit 1).

| Script | Arguments | What it does |
|---|---|---|
| `lib.sh` | sourced, not run | `wt_root` (find the root), `die`, `warn`, `step`, `dir_of` (branch to folder), `key_of` (path to Claude key), `bare_key`. Sets `BASE_BRANCH=main` and `CLAUDE_PROJECTS_DIR` (default `~/.claude/projects`). |
| `init.sh` | `<repo-url> [<dir>]` | New workspace from a remote. `<dir>` defaults to the repo name. Bare clone, `.git` pointer, fetch refspec, `main` worktree, `orchestrator` worktree (orphan created from templates if the remote has none), `local/` and its symlinks, `.bare/claude`. |
| `new.sh` | `<branch> [--from <branch>] [--no-install] [--push]` | New worktree. Uses an existing local branch, else tracks an existing `origin/<branch>`, else creates `<branch>` from `origin/<from>` (default `main`, no upstream). Symlinks `local`, runs `pnpm install` (skipped with `--no-install` or when there is no `package.json`), runs `claude-link.sh`. `--push` pushes and sets the upstream. |
| `merge.sh` | `<branch> [--no-push]` | Refuses `main`, a missing worktree, a worktree not on `<branch>`, or uncommitted changes in either worktree. Fetches `origin`, fast-forwards `main` from its upstream, rebases `<branch>` on `main`, runs the gate, pushes the rebased `<branch>` with `--force-with-lease` if `origin/<branch>` exists (so `rm.sh` can delete it later without `--force`; stops if origin moved since the fetch), `merge --no-ff` into `main` (message `Merge branch '<branch>'`), pushes `main` (both pushes skipped with `--no-push`). |
| `rm.sh` | `<branch> [--force]` | Refuses `main` and unknown branches. Without `--force`, refuses unless `<branch>` is merged into `main`. Removes the worktree (or prunes stale metadata if the folder is gone), deletes the local branch, deletes `origin/<branch>` if it is contained in `main` (always with `--force`), removes the Claude symlink. |
| `status.sh` | none | `git worktree list`, ahead/behind `main` for every local branch, the BOARD table rows, and a warning if `orchestrator/.claude` differs from `main/.claude`. |
| `claude-link.sh` | `<worktree-dir>` | Makes `~/.claude/projects/<worktree-key>` a symlink to `~/.claude/projects/<bare-key>`. Idempotent. Removes an empty real directory; moves a non-empty one to `<key>.bak-<yyyymmdd-hhmmss>` first. |

Environment variables the scripts read:

- `WT_GATE`: the gate command for `merge.sh`. Default `pnpm run check`. The e2e test sets
  it to `true`.
- `CLAUDE_PROJECTS_DIR`: where Claude Code keeps project data. Default
  `~/.claude/projects`. The e2e test points it at a temp folder.

Messages you will see when a precondition fails, for example:

```text
error: <root>/feat-pin already exists
error: origin/main does not exist; push it first
error: feat-pin has uncommitted changes
error: feat-pin does not have feat/pin checked out
error: feat/pin is not merged into main (use --force to discard it)
warn: origin/feat/pin has commits not in main; keeping it (use --force to delete)
```

### What each script does, by hand

These are the raw commands, so you can see what the scripts do and recover without them.
`<root>` is the workspace root.

`init.sh <url> <root>`:

```bash
git clone --bare <url> <root>/.bare
echo "gitdir: ./.bare" > <root>/.git
git -C <root> config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git -C <root> fetch origin
git -C <root> worktree add main main
# orchestrator exists on the remote:
git -C <root> worktree add --track -b orchestrator orchestrator origin/orchestrator
# or it does not (git < 2.42 has no "worktree add --orphan"):
git -C <root> worktree add --detach orchestrator main
cd <root>/orchestrator
git checkout --orphan orchestrator
git rm -rf .
cp -R ../main/docs/infra/templates/orchestrator/. .
cp -R ../main/.claude .claude
git add -A && git commit -m "chore: bootstrap orchestrator branch"
cd <root>
mkdir -p local
ln -s ../local main/local
ln -s ../local orchestrator/local
mkdir -p ~/.claude/projects/<bare-key>
ln -sfn ~/.claude/projects/<bare-key> .bare/claude
```

A bare clone has no fetch refspec, so without the `config remote.origin.fetch` line
`origin/*` refs never appear. When the orphan is new, push it once:
`git -C <root>/orchestrator push -u origin orchestrator`.

`new.sh feat/pin`:

```bash
git -C <root> fetch origin
git -C <root> worktree add --no-track -b feat/pin feat-pin origin/main
ln -s ../local <root>/feat-pin/local
(cd <root>/feat-pin && pnpm install)
<root>/main/tools/wt/claude-link.sh <root>/feat-pin
# only with --push:
git -C <root>/feat-pin push --set-upstream origin feat/pin
```

`merge.sh feat/pin`:

```bash
git -C <root>/feat-pin status --porcelain   # must be empty
git -C <root>/main status --porcelain       # must be empty
git -C <root> fetch origin
git -C <root>/main pull --ff-only
git -C <root>/feat-pin rebase main
(cd <root>/feat-pin && pnpm run check)
git -C <root>/feat-pin push --force-with-lease=feat/pin:<old origin/feat/pin> origin feat/pin  # only if origin/feat/pin exists
git -C <root>/main merge --no-ff -m "Merge branch 'feat/pin'" feat/pin
git -C <root>/main push origin main
```

`rm.sh feat/pin`:

```bash
git -C <root>/main branch --merged main     # must list feat/pin
git -C <root> worktree remove feat-pin
git -C <root> branch -d feat/pin
git -C <root> push origin --delete feat/pin
rm ~/.claude/projects/<feat-pin-key>        # only if it is a symlink
```

`claude-link.sh <root>/feat-pin`:

```bash
ln -s ~/.claude/projects/<bare-key> ~/.claude/projects/<feat-pin-key>
```

`<feat-pin-key>` is the absolute path of `feat-pin/` with every non-alphanumeric
character replaced by `-` (for example `-home-work-auth-gate-feat-pin`).

### Recovery

**Stale worktree.** The folder was deleted by hand, so git still lists it:

```bash
git -C <root> worktree list      # shows the path as "prunable"
git -C <root> worktree prune
```

`rm.sh` does this itself when the folder is missing.

**Detached HEAD.** `merge.sh` stops with `does not have <branch> checked out`. Check:

```bash
git -C <root>/feat-pin status
```

If a rebase is in progress, finish or abort it (next item). Otherwise switch back:

```bash
git -C <root>/feat-pin switch feat/pin
```

If you made commits while detached, save them first with
`git -C <root>/feat-pin branch rescue-<name>` and cherry-pick them onto `feat/pin`.

**Rebase conflict in `merge.sh`.** The script stops with:

```text
error: rebase conflict: resolve it in <root>/feat-pin and re-run, or run: git -C <root>/feat-pin rebase --abort
```

`main` has not moved at this point. The conflict is product code, so the orchestrator does
not resolve it: the human does, or a Claude session started in the feature worktree.
Either resolve:

```bash
cd <root>/feat-pin
git status                 # lists conflicted files
# edit, then:
git add <files>
git rebase --continue
../main/tools/wt/merge.sh feat/pin
```

or give up and leave the branch as it was:

```bash
git -C <root>/feat-pin rebase --abort
```

**Gate fails in `merge.sh`.** The branch is already rebased, `main` has not moved. Fix the
code in the feature worktree, commit, and re-run `merge.sh`.

**Push of `main` fails.** Local `main` has the merge commit but is not pushed. If the cause was
network or authentication, fix it and push by hand:

```bash
git -C <root>/main push origin main
```

If the push was rejected because `origin/main` moved, never force. Local `main` contains
only `origin/main` plus the feature, so move it back and merge again:

```bash
git -C <root>/main reset --hard origin/main
../main/tools/wt/merge.sh feat/pin
```

**`rm.sh` keeps `origin/<branch>` after a merge.** If the feature was pushed (`new.sh
--push`, or by hand), the remote copy holds the commits from before `merge.sh` rebased
them. Their hashes are not in `main`, so `rm.sh` warns
`origin/<branch> has commits not in main; keeping it (use --force to delete)`. The local
branch was already checked as merged, so the remote copy is obsolete. Delete it:

```bash
git -C <root> push origin --delete feat/pin
```

### Who touches the `main` worktree

Nobody works in `main/`. It exists so scripts can run from it and so `merge.sh` has a
place to merge into `main`. `merge.sh` refuses to run if `main/` has uncommitted
changes, so keep it clean. Changes to `main` arrive only through feature branches.

### How a merge is confirmed

`merge.sh` prints its steps and exits 0 on success, non-zero with an `error:` line on
failure. The human tells the orchestrator session the result; the orchestrator does not
record the gate output anywhere. Only after that confirmation does it print `rm.sh`.

### Keeping a long-running feature current

`merge.sh` rebases only at merge time. To pick up other merged work earlier, rebase in the
feature worktree yourself (never merge `main` into a feature):

```bash
cd <root>/feat-pin
git fetch origin
git rebase origin/main
pnpm install && pnpm run check
```

If the branch was pushed, its remote copy now differs; push with
`git push --force-with-lease` only on your own feature branch, never on `main`.
