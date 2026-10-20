# Bootstrap a new project

## Why

This is the file to follow when the same infrastructure is wanted for another project.
It is written as a checklist that a person, or a Claude session given only `docs/infra/`,
can follow from top to bottom. Every value that differs between projects is listed in
"Substitution points". The last section is the acceptance test: the setup is done when
every item in it passes.

There are two starting points:

- **Variant A, fresh from a remote.** The project is on a remote (GitHub or similar), or
  is new. You build the workspace with `init.sh`.
- **Variant B, convert an existing checkout.** The project is a normal clone on disk,
  maybe with uncommitted work and a private `local/` folder. You turn it into the bare
  layout in place.

## How

### Prerequisites

Check each one:

```bash
git --version            # 2.39 or newer
node --version           # 22 or newer
pnpm --version           # 10.13.1 (see 05-pnpm.md if corepack fails)
jq --version             # used by the hooks and statusline
claude --version         # Claude Code
```

Also: push access to the remote, and a `main` branch on it (Variant A).
shellcheck comes from the `shellcheck` npm dev dependency; no system install is needed.

### Substitution points

| What | In this project | Where it appears |
|---|---|---|
| Workspace root | `/home/work/auth-gate` | examples in `docs/infra/`, orchestrator `CLAUDE.md` "Your own continuity" line |
| Bare key | `-home-work-auth-gate--bare` | computed by `lib.sh` (`key_of "<root>/.bare"`); appears only in docs |
| Worktree key | `-home-work-auth-gate-<dir>` | computed by `lib.sh`; appears only in docs |
| Project description | auth-gate paragraph | `CLAUDE.md` first paragraph, `README.md` |
| Remote URL | the project's remote | `init.sh <repo-url>` argument |
| Base branch | `main` | `BASE_BRANCH` in `tools/wt/lib.sh` |
| pnpm version | `10.13.1` | `package.json` `packageManager` |
| Chat language | set in the template | last section of `docs/infra/templates/orchestrator/CLAUDE.md` |
| Lint targets | `tools/wt` and `.claude` scripts | `package.json` `lint` script |
| Context thresholds | `WARN=70`, `STOP=85` | top of `.claude/hooks/context-guard.sh` |

No script contains a hard-coded path or key; they derive everything from the folder that
contains `.bare` and from `CLAUDE_PROJECTS_DIR` (default `~/.claude/projects`).

### Files to copy into the new project's `main`

The source is the public repository https://github.com/huy090202/auth-gate, branch
`main`. It must be reachable from the machine (network access to GitHub). Fetch it into
a temporary folder:

```bash
src="$(mktemp -d)"
git clone --depth 1 --branch main https://github.com/huy090202/auth-gate.git "$src"
```

Then copy these paths from `$src` into the new project, keeping the paths:

```text
tools/wt/                     # all scripts, including tools/wt/test/
.claude/                      # settings.json, statusline.sh, hooks/, commands/handoff.md
docs/infra/                   # these docs and templates/orchestrator/ (init.sh needs it)
CLAUDE.md                     # then rewrite the first paragraph for the new project
.gitignore                    # keep the /local line exactly; drop entries that do not apply
```

If the new project has no pnpm setup yet, also copy and adapt `package.json` (scripts
`lint`, `test`, `check`, the `shellcheck` dev dependency, `packageManager`),
`.npmrc` and `.github/workflows/ci.yml`, then run `pnpm install`
to create `pnpm-lock.yaml`. If the project already has a gate under another name, set
`WT_GATE` when running `merge.sh`, or change the default in `merge.sh`.

The scripts must stay executable:

```bash
chmod +x tools/wt/*.sh tools/wt/test/*.sh
```

For example, into a checkout at `<dest>`:

```bash
mkdir -p <dest>/tools <dest>/docs
cp -R "$src/tools/wt" <dest>/tools/wt
cp -R "$src/.claude" <dest>/.claude
cp -R "$src/docs/infra" <dest>/docs/infra
cp "$src/CLAUDE.md" "$src/.gitignore" <dest>/
# only if <dest> has no pnpm setup yet:
cp "$src/package.json" "$src/.npmrc" <dest>/
mkdir -p <dest>/.github/workflows && cp "$src/.github/workflows/ci.yml" <dest>/.github/workflows/
```

When `package.json` is copied, change `name`. Remove `"$src"` when the setup is
done.

### Variant A: fresh from a remote

1. **Put the files on the remote's `main`.** Use any temporary normal clone:

   ```bash
   git clone <repo-url> /tmp/seed && cd /tmp/seed
   # copy the files listed above into /tmp/seed, edit CLAUDE.md
   pnpm install && pnpm run check
   git add -A && git commit -m "chore: worktree infrastructure"
   git push origin main
   ```

   For a brand-new empty repository, create `main` here with `git init -b main` and
   `git remote add origin <repo-url>` first.

2. **Build the workspace.** Run `init.sh` from the seed clone (any copy of it works):

   ```bash
   /tmp/seed/tools/wt/init.sh <repo-url> <root>
   ```

   It prints `==>` steps and ends with `Next:` lines. If it created a new orphan
   `orchestrator`, it prints the push command. Run what it prints:

   ```bash
   git -C <root>/orchestrator push -u origin orchestrator   # only if printed
   cd <root>/main && pnpm install
   ```

3. **Edit the orchestrator's `CLAUDE.md`.** In "Your own continuity", replace
   `<absolute path of this orchestrator worktree>` with `<root>/orchestrator`. Commit:

   ```bash
   git -C <root>/orchestrator commit -am "chore(board): set orchestrator path"
   git -C <root>/orchestrator push -u origin orchestrator
   ```

4. **Remove the seed clone:** `rm -rf /tmp/seed`.

5. **Create `local/` content** if needed (for example `local/rules.md`). It is private
   and never committed.

6. **Start the orchestrator and assign the first feature:**

   ```bash
   cd <root>/orchestrator && claude
   ```

   Say what to build. Claude adds a BOARD row (`planned`), writes
   `handoffs/feat-<name>/00-brief.md`, commits, and prints the `new.sh` and `claude`
   commands. Paste them. The lifecycle from there is in `02-worktree-lifecycle.md`.

### Variant B: convert an existing checkout

Start: a normal checkout at `<root>` with a `.git` directory, a remote, maybe a private
`local/` folder. Stop every editor and Claude session in it first.

1. **Commit first.** Add the files listed above and commit on `main`. With git 2.39 an
   unborn branch (no commits) cannot be checked out into a worktree, so a repository
   with no commits needs this first commit before the conversion. Commit or stash any
   other work you want to keep; uncommitted files will not appear in the new worktree.

   ```bash
   cd <root>
   git add -A && git commit -m "chore: worktree infrastructure"
   ```

2. **Turn `.git` into `.bare`.** The object database does not change; only its location
   and mode.

   ```bash
   mv .git .bare
   git --git-dir=.bare config core.bare true
   echo "gitdir: ./.bare" > .git
   git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
   git fetch origin
   ```

3. **Create `main`.** Then delete the old root-level copies of committed files (not
   `local/`, not `.bare`, not `.git`, not `main/`). Compare first; anything untracked
   that you want must be moved into `main/` by hand.

   ```bash
   git worktree add main main
   git -C main ls-files | cut -d/ -f1 | sort -u      # top-level names now in main/
   # remove those names from <root>, e.g.:
   # rm -rf README.md LICENSE docs tools .claude ...
   ```

4. **Create the orphan `orchestrator`.** git 2.42 added `git worktree add --orphan`; for
   older git, add a detached worktree and orphan it:

   ```bash
   git worktree add --detach orchestrator main
   cd orchestrator
   git checkout --orphan orchestrator
   git rm -rfq .
   cp -R ../main/docs/infra/templates/orchestrator/. .
   cp -R ../main/.claude .claude
   # edit CLAUDE.md: set the orchestrator path in "Your own continuity"
   git add -A && git commit -m "chore: bootstrap orchestrator branch"
   git push -u origin orchestrator
   cd ..
   ```

5. **Link `local/`.**

   ```bash
   mkdir -p local
   ln -s ../local main/local
   ln -s ../local orchestrator/local
   ```

6. **Claude data.** Find the old key (the root path, e.g. `-home-work-myproj`) and the
   new bare key (e.g. `-home-work-myproj--bare`). Copy the old memory without
   overwriting, link `.bare/claude`, and link the two worktrees:

   ```bash
   old=~/.claude/projects/<root-key>
   new=~/.claude/projects/<bare-key>
   mkdir -p "$new/memory"
   [ -d "$old/memory" ] && cp -n "$old/memory/"* "$new/memory/"
   ln -sfn "$new" .bare/claude
   main/tools/wt/claude-link.sh main
   main/tools/wt/claude-link.sh orchestrator
   ```

   Do this after the Claude session that ran in the old checkout has ended, so it does
   not write to the old key afterwards. To confirm the real memory key, run
   `claude -p 'Which directory is your auto memory directory?'` inside `main/`.

7. **Push.**

   ```bash
   git -C main push origin main
   ```

   (`orchestrator` was pushed in step 4.)

8. **Install dependencies** in the new `main` worktree:

   ```bash
   cd <root>/main && pnpm install
   ```

9. Continue with Variant A steps 6 and 7.

### Acceptance test

The setup is done when all of these pass. Use a throwaway feature such as `feat/smoke`.

1. `git -C <root> worktree list` shows `.bare`, `main`, `orchestrator`, and one feature
   worktree created by `new.sh`, each on the expected branch.
2. In the feature worktree: `ls -l local` is a symlink, `pnpm install` has run, and
   `pnpm run check` passes.
3. Starting `claude` in the feature worktree shows the BOARD row and the brief in the
   first context: asked "what is your assignment?", the first reply knows it.
4. The status bar shows `<branch> | ctx N% | $...`, and `/tmp/claude-ctx/<session_id>`
   contains a number.
5. Setting `WARN=0` in `.claude/hooks/context-guard.sh` makes the next prompt carry the
   warning line (the reply mentions `/handoff`). Restore `WARN=70`.
6. `/handoff` creates a file under `../orchestrator/handoffs/<dir>/`, updates the BOARD
   row, and `git -C ../orchestrator log -1` shows a new commit.
7. The transcript smoke test has a recorded result: after `claude-link.sh`, a `claude -p`
   run in the feature worktree leaves its transcript under `<root>/.bare/claude/`, and
   the worktree key is still a symlink. Record the outcome in `04-claude-sessions.md`.
8. `merge.sh` on the feature merges it into `main` with one merge commit; `rm.sh` then leaves no worktree, no
   local branch, no remote branch, and no dangling Claude symlink.
9. `init.sh` run in a scratch directory against the remote reproduces the layout
   (`.bare`, `.git`, `local`, `main`, `orchestrator`), with `orchestrator` tracking the
   existing remote branch. Clean up the scratch folder and its
   `~/.claude/projects/<scratch-bare-key>` afterwards.
10. A fresh Claude session given only `docs/infra/` can explain the layout and the
    lifecycle without reading the scripts.
