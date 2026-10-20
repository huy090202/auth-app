# Claude Code sessions: memory, transcripts, handoffs, hooks

## Why

A Claude Code session is bounded by its context window. When it ends, the next session
knows nothing of it unless something carries the state across. Claude Code has two
built-in stores, auto memory and transcripts, but neither is the right carrier for "what
this worktree is doing and where it stopped":

- Memory holds durable facts about the project, shared by every worktree.
- A transcript is megabytes of tool output. Nobody reads it, and resuming one brings back
  a full context window.

What a new session needs is short: the assignment, what was done, the exact state of
work in progress, and the next command. That is a handoff file. A hook puts it in front
of Claude before the first prompt, and a context guard makes sure it gets written before
the window runs out.

## How

### Three facts about Claude Code

From the docs (read on 2026-10-18) and checked on this machine:

1. **Auto memory** lives at `~/.claude/projects/<key>/memory/`. For a git repository the
   key is derived from the repository, not the working directory, so all worktrees of
   one repository share one memory directory. With a bare layout, the key is the `.bare`
   path, for example `-srv-myproj--bare` for `/srv/myproj/.bare`.
   (https://code.claude.com/docs/en/memory, https://code.claude.com/docs/en/worktrees)
2. **Transcripts** (`<session-id>.jsonl`) live under the key of the working directory, so
   each worktree gets its own transcript folder by default. `claude --resume` can still
   list sessions from all worktrees of the repository and resume one by id.
   (https://code.claude.com/docs/en/sessions)
3. **Claude does not know its own context usage.** Only the statusline command receives
   `context_window.used_percentage` on stdin. Hooks on `SessionStart` and
   `UserPromptSubmit` can add text to Claude's context through stdout.
   (https://code.claude.com/docs/en/statusline, https://code.claude.com/docs/en/hooks,
   https://code.claude.com/docs/en/env-vars)

A key is an absolute path with every non-alphanumeric character replaced by `-`:
`/srv/myproj/.bare` becomes `-srv-myproj--bare` (the `/.` gives two
dashes). `tools/wt/lib.sh` implements this as `key_of`.

### The design

1. **Memory: the default.** Nothing to configure. `<root>/.bare/claude` is a symlink to
   `~/.claude/projects/<bare-key>/` so a human can find it.
2. **Transcripts: one place.** `tools/wt/claude-link.sh <worktree>` makes
   `~/.claude/projects/<worktree-key>` a symlink to `~/.claude/projects/<bare-key>`.
   `new.sh` runs it for every new worktree. Run it once by hand for `main` and
   `orchestrator` (`init.sh` does not). `rm.sh` removes the link. This is a convenience:
   if it ever stops working, only where transcripts sit changes.
3. **Continuity: the handoff.** `/handoff` writes it; the `SessionStart` hook injects it.

### Files

```text
.claude/
├── settings.json          # registers the statusline and both hooks
├── statusline.sh
├── hooks/
│   ├── session-start.sh
│   └── context-guard.sh
└── commands/
    └── handoff.md         # /handoff
```

`settings.json`:

```json
{
  "statusLine": { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/statusline.sh" },
  "hooks": {
    "SessionStart": [ { "matcher": "startup|resume|clear|compact",
      "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-start.sh" } ] } ],
    "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/context-guard.sh" } ] } ]
  }
}
```

All three scripts need `jq`. Both hooks always exit 0 and swallow their own errors, so a
broken hook never blocks a session.

### Statusline: `.claude/statusline.sh`

- **Input (stdin):** the statusline JSON. It reads `session_id`,
  `workspace.current_dir`, `context_window.used_percentage`, `cost.total_cost_usd`.
- **Output (stdout):** one line, `<branch> | ctx <N>% | $<cost>`, for example
  `feat/pin | ctx 42% | $0.37`. `<N>` is rounded down; the branch is `-` outside git.
- **Side effect:** writes `<N>` to `/tmp/claude-ctx/<session_id>` (directory overridable
  with `CLAUDE_CTX_DIR`). Characters other than letters, digits, `_` and `-` in the
  session id become `_`.

This file is the only bridge between the context percentage and the hooks.


The files in `/tmp/claude-ctx/` are one small number per session. Nothing deletes them;
they disappear when `/tmp` is cleared, and deleting them by hand at any time is safe.

### Context guard: `.claude/hooks/context-guard.sh`

- **Event:** `UserPromptSubmit`, every prompt.
- **Input (stdin):** the hook JSON; it reads `session_id`, then
  `/tmp/claude-ctx/<session_id>`.
- **Output:** nothing below 70 %. Stdout of a `UserPromptSubmit` hook is added to
  Claude's context, so Claude sees these lines on that turn:
  - from 70 %: `[context-guard] Context is at N%. Finish the current step, then run /handoff and tell the user to start a new session.`
  - from 85 %: `[context-guard] Context is at N%. STOP. Write the handoff now with /handoff and print the command to start a new session. Do not start new work.`
- **No file, unreadable file or non-number:** prints nothing.

The thresholds are the two lines at the top of the script:

```bash
WARN=70
STOP=85
```

Change them there, then copy `.claude/` to the orchestrator branch (see
`03-orchestrator.md`). To test the guard, set `WARN=0`, send any prompt, and look for the
warning in the reply. Restore `WARN=70` afterwards.

The percentage lags by one update: the statusline writes it after a response, and the
guard reads it on the next prompt. That is fine for thresholds this far from 100 %.

### Session start: `.claude/hooks/session-start.sh`

- **Event:** `SessionStart` with matcher `startup|resume|clear|compact`, so it also runs
  after `/clear` and after compaction.
- **Input (stdin):** the hook JSON; it reads `cwd` (falls back to `$PWD`).
- **Output (stdout, added to context):**
  - If `../orchestrator` does not exist: `Orchestrator worktree not found at ../orchestrator.`
  - In the orchestrator worktree (branch `orchestrator`): the first 200 lines of `BOARD.md`,
    then the newest handoff in `handoffs/orchestrator/` the same way (first 120 lines,
    or `No handoff yet.`).
  - Otherwise:
    1. The BOARD row whose first column equals the folder name, or
       `No BOARD row for <dir>. Ask the orchestrator session for an assignment.`
    2. `--- latest handoff: <file> ---` and the first 120 lines of the newest `*.md` in
       `../orchestrator/handoffs/<dir>/` (by name, so `00-brief.md` until the first
       handoff), or `No handoff yet.`
    3. `More: docs/infra/00-overview.md`

To see exactly what a session will receive, run it by hand from a worktree:

```bash
echo "{\"cwd\":\"$PWD\"}" | bash .claude/hooks/session-start.sh
```

### `/handoff`: `.claude/commands/handoff.md`

A project slash command. It tells Claude to:

1. Work out `<dir>` (folder name), `<branch>` and `<yyyy-mm-dd-hhmm>`
   (`date +%Y-%m-%d-%H%M`).
2. Write `../orchestrator/handoffs/<dir>/<yyyy-mm-dd-hhmm>.md` in the handoff format
   (`03-orchestrator.md`). In the orchestrator worktree, write under
   `handoffs/orchestrator/`.
3. Update this worktree's BOARD row: Status (`active`, or `review` when done) and Last
   handoff. Add a row if there is none.
4. Commit on orchestrator:
   `git -C ../orchestrator add BOARD.md handoffs/<dir> && git -C ../orchestrator commit -m "chore(board): handoff <branch> <timestamp>"`
   (orchestrator itself: `handoffs/orchestrator`). Never `add -A`: it would sweep up
   another session's uncommitted edits.
5. End the reply with `cd <abs worktree> && claude` on its own line.

Run it when the work is done, when the guard warns, or before stopping for the day.

## Verified on 2026-10-18

1. **Memory key.** Running `claude -p` inside `main/` reported the memory directory as
   `~/.claude/projects/-home-work-auth-gate--bare/memory/`. Auto memory is keyed by the
   git directory (`.bare`) and shared by all worktrees. Transcripts for `main/` went to
   the per-worktree key `-home-work-auth-gate-main/` (`main` was not linked yet at that
   time).
2. **Transcript smoke test.** After `claude-link.sh` made
   `~/.claude/projects/-home-work-auth-gate-feat-infra-tooling` a symlink to the `.bare`
   key, a `claude -p` transcript landed under `.bare/claude/`, and the link stayed a
   symlink. The symlinked project directory is honoured.
3. **SessionStart injection.** Verified interactively in a throwaway `feat/smoke`
   worktree. Asked "what is your assignment?", the first reply restated the brief in full
   with no tool calls, so the content came from the hook, not from Claude reading files.
   In the orchestrator worktree the first reply likewise knew the BOARD.
4. **Memory migration.** The planning session that ran before the conversion to the bare
   layout had its memory under `-home-work-auth-gate/`. It was copied with `cp -n` into
   the `.bare` key.
5. **Statusline.** The status bar showed `feat/smoke | ctx 4% | $0.15`, so
   `$CLAUDE_PROJECT_DIR` expands in the `statusLine` command, and the percentage file under
   `/tmp/claude-ctx/` held the same number.
6. **Context guard.** With `WARN=0` set by hand, the next prompt carried the warning: the
   session mentioned the guard and `/handoff`. Restore `WARN=70` before committing; the
   orchestrator also flags a modified `context-guard.sh` as a dirty worktree.
7. **`/handoff`.** It wrote `handoffs/feat-smoke/<timestamp>.md` with an empty Remaining,
   moved the BOARD row to `review`, committed on the orchestrator branch, and printed the
   new-session command.
8. **Merge and removal.** From the orchestrator session, "feat/smoke is done" produced a
   check of the handoff and BOARD and then `merge.sh feat/smoke`. The merge rebased,
   passed the gate, fast-forwarded and pushed `main`. `rm.sh feat/smoke` removed the
   worktree and the local branch, and left the remote alone because it was never pushed.
