# Workspace layout

## Why

Git worktrees let many branches be checked out at once over one object database. Where
the repository itself lives decides how clean the layout is. With a normal checkout, the
first worktree *is* the repository, and the others hang off it unevenly. With a bare
repository in a hidden `.bare/` folder, every branch is a sibling folder and none is
special. Paths become predictable, so scripts and humans can find any branch without a
lookup, and sessions can reach each other's files with `../<dir>`.

## How

### The root

```text
<root>/
├── .bare/          # the repository: objects, refs, config, worktree metadata
│   └── claude -> ~/.claude/projects/<bare-key>/
├── .git            # a file with one line: gitdir: ./.bare
├── local/          # private, gitignored notes and secrets (the one real copy)
├── main/           # branch main
├── orchestrator/   # branch orchestrator (orphan)
└── feat-<name>/    # branch feat/<name>
```

- `.bare/` is a bare clone (`core.bare = true`). Deleting it destroys every worktree.
- `.git` lets git commands run from the root (for example `git -C <root> worktree list`).
- Inside each worktree, `.git` is a file pointing at `.bare/worktrees/<dir>`. That is
  normal for worktrees.
- `<bare-key>` is the absolute path of `.bare` with every non-alphanumeric character
  replaced by `-`. For `/srv/myproj/.bare` it is `-srv-myproj--bare`.

### Rules

- **Directory name = branch name with `/` replaced by `-`.** `feat/pin` lives in
  `feat-pin/`. No exceptions. `tools/wt/lib.sh` implements this as `dir_of`.
- **`main` is the only baseline.** Features fork from `origin/main` and return by rebase
  then a `--no-ff` merge. History is semi-linear: each feature is a straight run of
  commits closed by one merge commit, and no feature branch contains merges of its own.
- **`orchestrator` is an orphan branch.** No shared history with `main`, never merged
  into it, pushed to the remote as a backup.
- **`local/` is a symlink in every worktree** to `../local`.
- **The root is not a place to run Claude.** Sessions run inside `main/`,
  `orchestrator/` or a `feat-*/` folder. The hooks find the orchestrator at
  `../orchestrator`, which only works from a worktree folder.

### What lives on which branch

`main`:

```text
main/
├── .claude/
│   ├── settings.json         # statusline + hooks, committed
│   ├── statusline.sh         # shows branch, context %, cost; records the % for the guard
│   ├── hooks/
│   │   ├── session-start.sh  # injects BOARD row + latest handoff into a new session
│   │   └── context-guard.sh  # injects a warning when context >= 70 %
│   └── commands/
│       └── handoff.md        # /handoff
├── docs/
│   ├── infra/                # these documents, plus templates/orchestrator/
│   ├── adr/                  # architecture decision records
│   └── superpowers/          # specs and plans
├── tools/wt/                 # worktree scripts, and tools/wt/test/
├── .github/workflows/ci.yml  # runs the gate
├── .gitignore  .npmrc  package.json  pnpm-lock.yaml
├── CLAUDE.md                 # rules for feature sessions
└── README.md  LICENSE  CONTRIBUTING.md
```

`orchestrator`:

```text
orchestrator/
├── .claude/                  # copy of main's .claude/; status.sh warns on drift
├── .gitignore                # /local
├── CLAUDE.md                 # the orchestrator role
├── BOARD.md                  # who does what, in which state
└── handoffs/
    ├── <dir>/                # e.g. feat-pin/
    │   ├── 00-brief.md       # the assignment
    │   └── <yyyy-mm-dd-hhmm>.md
    └── orchestrator/         # the orchestrator's own handoffs
```

The starting content of this branch is in `docs/infra/templates/orchestrator/` on
`main`. `init.sh` copies it (plus `main/.claude`) when it creates the orphan branch.

`feat/*`: forked from `main`, so each feature worktree has `main`'s `.claude/`,
`CLAUDE.md` and tooling. It reads the orchestrator's files through `../orchestrator/`.

Why `.claude/` is a copy on `orchestrator` and not a symlink: Claude Code treats settings
that resolve outside the project as external. A copy is simpler; `status.sh` reports drift.

### `local/` and `.gitignore`

`local/` holds private, gitignored notes and secrets. There is one real folder at the
root. Each worktree has a symlink `local -> ../local`, created by `init.sh` and `new.sh`.
If `local/rules.md` exists, `CLAUDE.md` tells sessions it takes precedence.

`.gitignore` on `main`:

```gitignore
/local
node_modules/
.env
.env.*
!.env.example
.claude/settings.local.json
bruno/environments/*.yml
!bruno/environments/*.example.yml
.superpowers/
```

The first line is `/local`, not `local/`. In a worktree, `local` is a symlink, which git
sees as a file. A pattern with a trailing slash matches only directories, so `local/`
would leave the symlink showing as untracked. `/local` matches a file or a directory
named `local` at the top level. The orchestrator branch has its own `.gitignore` with the
same `/local` line.

`.superpowers/` holds per-session scratch files of a planning tool and is never committed.

### The `.bare/claude` symlink

`.bare/claude` points at `~/.claude/projects/<bare-key>/`, the directory where Claude Code
keeps this repository's auto memory, and (after `claude-link.sh`) every worktree's
transcripts. It exists only so a human can find that data. Claude Code does not read it.
See `04-claude-sessions.md`.
