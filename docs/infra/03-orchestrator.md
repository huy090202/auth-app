# The orchestrator

## Why

With several features in flight, something has to answer: who is building what, in which
state is it, what did the last session leave behind, and is this branch ready to merge?
If each feature session decides for itself, nobody has the whole picture, and a session
can merge or delete things the human has not approved.

So one Claude session, in the `orchestrator/` worktree, does only coordination. Its state
is plain files on the orphan `orchestrator` branch, committed after every change, so the
history of decisions is versioned and backed up. It never touches product code, and it
never runs the worktree scripts: it prints them, and the human pastes them. That keeps a
human hand on every change to the workspace.

## How

### The role

The orchestrator's `CLAUDE.md` (template: `docs/infra/templates/orchestrator/CLAUDE.md`)
says:

- You coordinate. You never write product code, and you never edit files in another
  worktree except `BOARD.md` and `handoffs/` here.
- `BOARD.md` is the single source of truth. Keep it current.
- Every action on a worktree is a fenced bash block the human pastes, using
  `../main/tools/wt/`. Never run the scripts yourself.
- One feature per worktree. Directory name = branch name with `/` replaced by `-`.
- Before printing `merge.sh`: the newest handoff's "Remaining" section must be empty or
  say `none`, and the row must be `review`. Otherwise say what is missing and stop.
- After `rm.sh` is confirmed: set the row to `merged` and commit.
- Commit on the `orchestrator` branch after every BOARD or handoff change, with a
  `chore(board): ...` message. Uncommitted state is lost state.
- Chat language is a per-project choice; the template sets one. Files and commits are in
  English.

When `claude` starts in `orchestrator/`, the `SessionStart` hook prints the whole BOARD
(not one row).

### `BOARD.md`

```markdown
# Board

| Worktree | Branch | Task | Status | Last handoff | Notes |
|---|---|---|---|---|---|
| feat-pin | feat/pin | PIN factor | active | 2026-10-18-1640 | |

Status values: planned, active, review, merged, abandoned.
```

- **Worktree** is the folder name. The `SessionStart` hook matches this first column
  exactly against the current folder name, so it must be the `<dir>`, not the branch.
- **Last handoff** is the handoff file name without `.md` (`00-brief` before the first
  handoff).

Status vocabulary:

| Status | Meaning | Set by |
|---|---|---|
| `planned` | Brief written, worktree may not exist yet | orchestrator, at assignment |
| `active` | A feature session is working; work remains | `/handoff` |
| `review` | The feature session says it is done | `/handoff` |
| `merged` | `merge.sh` and `rm.sh` succeeded | orchestrator |
| `abandoned` | Dropped; removed with `rm.sh --force` | orchestrator |

### The brief: `handoffs/<dir>/00-brief.md`

Written by the orchestrator at assignment. Four sections:

```markdown
# Brief: feat/pin

## Goal
What to build, in two or three sentences.

## Constraints
What must not change, libraries to use or avoid, limits.

## Definition of done
Checkable items, including "pnpm run check passes".

## References
Spec and plan paths, ADRs, issues.
```

The name starts with `00-` so it sorts before every timestamped handoff. The hook shows
the newest file by name, so the brief is shown only until the first handoff exists.

### The handoff: `handoffs/<dir>/<yyyy-mm-dd-hhmm>.md`

Written by the feature session through `/handoff`:

```markdown
# Handoff: feat/pin — 2026-10-18 16:40

## Done
- ...

## In progress (exact state)
- file, branch state, failing test, whatever a stranger needs to continue

## Remaining
- ...

## Decisions and gotchas
- ...

## Next command
cd <root>/feat-pin && claude
```

"Done" means two things together: the BOARD row is `review` (set by `/handoff` when the
work is finished), and the newest handoff's "Remaining" section is empty or says
`none`. The orchestrator checks both before printing `merge.sh`.

Handoff folders are kept after `rm.sh` and after abandonment. They are the history of
the feature; nothing deletes them. Remove one by hand (and commit) only if it is noise.

### The commit rule

Every change to `BOARD.md` or `handoffs/` is followed by a commit on `orchestrator`.
Feature sessions commit there too, from their own worktree:

```bash
git -C ../orchestrator add BOARD.md handoffs/feat-pin
git -C ../orchestrator commit -m "chore(board): handoff feat/pin 2026-10-18-1640"
```

Push the branch when convenient (`git -C <root>/orchestrator push`); it is the backup.

### What the orchestrator must never do

- Write or edit product code, in any worktree.
- Run `new.sh`, `merge.sh`, `rm.sh` or any git command that changes another worktree.
- Print `merge.sh` for a branch whose newest handoff still lists remaining work, or whose
  row is not `review`.
- Leave a BOARD change uncommitted.
- Merge `orchestrator` into `main`, or `main` into `orchestrator`.

### The orchestrator's own handoff

The orchestrator also runs out of context. When the context guard fires, it writes
`handoffs/orchestrator/<yyyy-mm-dd-hhmm>.md` in the same handoff format, commits, and
prints `cd <root>/orchestrator && claude`. Note: the `SessionStart` hook in the
orchestrator worktree prints only the BOARD, not this handoff. A new orchestrator session
should read the newest file in `handoffs/orchestrator/` itself.

### Keeping `.claude/` in sync

The orchestrator branch carries a copy of `main/.claude/`. After `.claude/` changes on
`main`, copy it over and commit:

```bash
rm -rf <root>/orchestrator/.claude
cp -R <root>/main/.claude <root>/orchestrator/.claude
git -C <root>/orchestrator add -A
git -C <root>/orchestrator commit -m "chore(board): sync .claude from main"
```

`../main/tools/wt/status.sh` warns `orchestrator/.claude differs from main/.claude` until
this is done.

### Known limits

- **Concurrent commits.** Feature sessions commit on `orchestrator`, staging only `BOARD.md` and their own `handoffs/<dir>`. If two
  sessions hand off at the same moment, one commit can include the other's uncommitted
  BOARD edit. Nothing is lost (the other commit then finds nothing left to add, or adds
  the rest), but the commit messages may not match the content. Hand off one session at
  a time when you can.
- **Same-minute handoffs.** File names have minute resolution. Two handoffs from the same
  worktree in the same minute would overwrite each other. In practice a handoff ends a
  session, so this does not happen.
- **The brief after the first handoff.** The hook shows only the newest file, so once a
  handoff exists the brief is no longer injected. Each handoff's "Remaining" section must
  therefore carry what is left of the brief's definition of done. The brief stays in
  `handoffs/<dir>/00-brief.md`, and a session can read it at any time.
