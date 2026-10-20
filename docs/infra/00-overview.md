# Workspace infrastructure: overview

## Why

Two problems drive this design.

1. **Parallel features.** Several features are built at once, each in its own editor
   window and its own Claude Code session. A normal checkout has one working tree, so
   parallel work means stashing, switching branches or cloning again.
2. **Sessions that forget.** A Claude Code session ends when its context window fills or
   the human stops. The next session starts from zero unless something tells it what the
   project is, what this worktree was assigned, and where the last session stopped.

The answer has three parts:

- A **bare repository with one worktree per branch**, all sibling folders.
- An **orchestrator**: an orphan branch and a dedicated Claude session that assigns work,
  tracks it on a board, and prints the commands the human pastes.
- **Handoff files and hooks**: each session ends by writing a short handoff; each new
  session gets its assignment and the latest handoff injected before the first prompt.

These documents are written so a person can understand every piece, and so a fresh
Claude session, given only this folder, can rebuild the same setup for another project.

## How

### The picture

```text
<root>/                               # workspace root. NOT a checkout.
├── .bare/                            # the git repository (object db, refs, worktree metadata)
│   └── claude -> ~/.claude/projects/<bare-key>/
├── .git                              # one line: "gitdir: ./.bare"
├── local/                            # the one real copy, gitignored, symlinked into every worktree
├── main/                             # worktree on branch main: product code, docs, tooling
├── orchestrator/                     # worktree on branch orchestrator: coordination state only
└── feat-<name>/                      # worktree on branch feat/<name>, forked from main
```

`<root>` is the workspace root, for example `/srv/myproj`. `<bare-key>` is derived from
it (`-srv-myproj--bare`). For a real project, substitute its own path everywhere (see `06-bootstrap-new-project.md`).

### Vocabulary

- **Workspace root**: the folder above all worktrees. Not a checkout; never run Claude here.
- **`<dir>`**: a worktree's folder name. Always the branch name with `/` replaced by `-`
  (`feat/pin` lives in `feat-pin/`).
- **Gate**: `pnpm run check` (`pnpm run lint`, `pnpm run test`, then `make check`). It must pass before merge.
- **BOARD**: `orchestrator/BOARD.md`, one table of who does what.
- **Brief**: `orchestrator/handoffs/<dir>/00-brief.md`, the assignment.
- **Handoff**: `orchestrator/handoffs/<dir>/<yyyy-mm-dd-hhmm>.md`, where a session stopped.

### Reading order

1. `01-workspace-layout.md`: the folders, the branches, what each one contains, `local/`.
2. `02-worktree-lifecycle.md`: a feature from assignment to removal; every script and flag;
   what each script does by hand; recovery.
3. `03-orchestrator.md`: the coordinating session, BOARD, brief and handoff formats.
4. `04-claude-sessions.md`: where Claude Code keeps memory and transcripts, the hooks, the
   statusline, the context guard, `/handoff`, and what was verified.
5. `05-pnpm.md`: why pnpm, the corepack problem, how the gate is composed.
6. `06-bootstrap-new-project.md`: the checklist to rebuild all of this for a new project,
   and the acceptance test.

### Summary of each file

**01-workspace-layout.** The root holds `.bare/` (the repository), a `.git` pointer file,
`local/`, and one folder per branch. `main` carries product code, docs and tooling.
`orchestrator` is an orphan branch carrying only the board, briefs, handoffs and a copy of
`.claude/`. Feature branches fork from `main`. `local/` is one real folder at the root,
symlinked into every worktree and ignored by git through the `/local` pattern.

**02-worktree-lifecycle.** Five steps: assign (orchestrator writes a BOARD row and a brief,
prints `new.sh`), build (the feature session starts with its brief injected), hand off
(`/handoff` writes a handoff and updates the BOARD), merge (`merge.sh` rebases, runs the
gate, merges with a merge commit and pushes `main`), remove (`rm.sh` deletes the worktree, branches and
Claude link). Then every script's flags, the raw git commands behind each, and recovery.

**03-orchestrator.** One Claude session in `orchestrator/` coordinates. It never writes
product code and never runs the scripts; it prints them. It keeps `BOARD.md` current and
commits after every change, because that branch is the state.

**04-claude-sessions.** Auto memory is keyed by the git directory, so all worktrees share
it. Transcripts are keyed by the working directory; `claude-link.sh` points each
worktree's key at the shared one. Continuity comes from handoffs, injected by a
`SessionStart` hook. The statusline records context usage; a `UserPromptSubmit` hook warns
at 70 % and orders a handoff at 85 %.

**05-pnpm.** pnpm keeps one content-addressable store and hard-links packages into each
worktree, so worktrees do not multiply disk use. Corepack's pnpm shim can fail signature
verification; install pnpm globally instead. The gate is `lint && test && make check`.

**06-bootstrap-new-project.** Prerequisites, files to copy, values to substitute, the
"fresh from a remote" path (`init.sh`), the "convert an existing checkout" path, and the
checklist that proves the result works.
