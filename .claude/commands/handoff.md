---
description: Write a handoff for the next session and update the BOARD
---

Write a handoff so a fresh session can continue this work without the transcript.

1. Determine `<dir>` (basename of the current worktree), `<branch>` (`git branch --show-current`) and the timestamp `<yyyy-mm-dd-hhmm>` (`date +%Y-%m-%d-%H%M`).
2. Write `../orchestrator/handoffs/<dir>/<yyyy-mm-dd-hhmm>.md` (create the folder if needed). In the orchestrator worktree, write under `handoffs/orchestrator/` instead. Use exactly this format:

```markdown
# Handoff: <branch> — <yyyy-mm-dd hh:mm>

## Done
- ...

## In progress (exact state)
- file, branch state, failing test, whatever a stranger needs to continue

## Remaining
- ...

## Decisions and gotchas
- ...

## Next command
cd <abs worktree> && claude
```

3. In `../orchestrator/BOARD.md`, update this worktree's row: set Status (`active`, `review` when the work is done, etc.) and set Last handoff to `<yyyy-mm-dd-hhmm>`. If the BOARD has no row for this worktree, add one (`| <dir> | <branch> | <task> | <status> | <timestamp> | |`).
4. Commit on the orchestrator branch: stage only your own files, then commit: `git -C ../orchestrator add BOARD.md handoffs/<dir> && git -C ../orchestrator commit -m "chore(board): handoff <branch> <timestamp>"` (in the orchestrator worktree itself, stage `BOARD.md handoffs/orchestrator`).
5. End your reply with the command to start the new session, on its own line: `cd <abs worktree> && claude`.
