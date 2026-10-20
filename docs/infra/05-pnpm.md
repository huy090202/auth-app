# pnpm

## Why

Every worktree is a full checkout and needs its own `node_modules`. With npm, five
worktrees mean five full copies of every dependency. pnpm keeps one content-addressable
store per machine (default `~/.local/share/pnpm/store`) and fills each `node_modules` with
hard links into it. A second worktree costs links, not a second copy, and installs are
fast. Each worktree still runs its own `pnpm install`, so worktrees on different branches
can have different dependencies.

## How

### Version pinning

`package.json` at the repository root:

```json
{
  "packageManager": "pnpm@10.13.1",
  "engines": { "node": ">=22" }
}
```

`packageManager` documents the version and is what CI's `pnpm/action-setup` reads.
There is no pnpm workspace: pnpm only runs the shell tooling, and the Go module is built by `make`.

`.npmrc` is committed with only a comment, so the place for a future setting is obvious.

### The corepack problem

On this machine, corepack's pnpm shim failed signature verification with:

```text
Cannot find matching keyid
```

The fix removes only corepack's pnpm shim and installs pnpm as a normal global package:

```bash
corepack disable pnpm
npm install -g pnpm@10.13.1
```

Check:

```bash
which pnpm && pnpm --version && pnpm store path
```

Expected: a path ending in `/bin/pnpm`, `10.13.1`, and a store path under
`~/.local/share/pnpm/store/`.

Do not run `corepack disable` without an argument. That removes the yarn shims too, and
other projects on the machine may rely on corepack for yarn.

### The gate

`pnpm run check` is the gate. `merge.sh` runs it in the feature worktree before
merging into `main`, and CI runs it on every push to `main` and every pull request.

```json
"scripts": {
  "lint": "shellcheck -x tools/wt/*.sh tools/wt/test/*.sh .claude/statusline.sh .claude/hooks/*.sh",
  "test": "bash tools/wt/test/hooks.sh && bash tools/wt/test/e2e.sh",
  "check": "pnpm run lint && pnpm run test && make check"
}
```

- `lint` runs shellcheck from the `shellcheck` dev dependency (an npm package that ships
  the binary), so no system install is needed. pnpm 10 does not run dependency install
  scripts by default, so the binary is downloaded the first time `lint` runs in each new
  worktree (a few `[INFO ] ShellCheck binary not found ... downloading` lines, then it is
  cached in that worktree's `node_modules`). This needs network access once per worktree.
- `test` runs the two hermetic shell tests: `hooks.sh` (statusline and hooks) and
  `e2e.sh` (every `tools/wt` script against a throwaway remote in a temp folder).
- `check` also runs `make check` (`go vet`, `golangci-lint run`, `go test`) for the Go module.

The order is cheap to expensive, and `&&` stops at the first failure.

CI (`.github/workflows/ci.yml`) is checkout, `pnpm/action-setup@v4`, `setup-node@v4`
with Node 22 and the pnpm cache, `pnpm install --frozen-lockfile`, `pnpm run check`.
