# worktree-up

`worktree-up` copies local setup files from a repository's main checkout into the current Git worktree, then runs repository-defined setup commands.

## Usage

```bash
npx worktree-up
```

`worktree-up` must be run inside a Git checkout or linked worktree.

## Example

### 1. Add config

Put this in your main repository checkout (not the worktree):

If using `package.json`, add this to the root `package.json`:

```json
{
  // ...rest of your package.json
  "worktree-up": {
    "copy": ["**/.env.local", "**/.env", "**/settings.local.json"],
    "run": ["pnpm install", "pnpm db:generate"]
  }
}
```

Or create a repo root `worktree-up.json` (works for non-JS repos):

```json
{
  "copy": ["**/.env.local", "**/.env", "**/settings.local.json"],
  "run": ["mise install", "just bootstrap"]
}
```

> [!IMPORTANT]
> Both `worktree-up.json` and `package.json."worktree-up"` configs cannot exist, `worktree-up` will throw an error.

### 2. Create a worktree and run it

From your main checkout:

```bash
git worktree add ../my-repo-feature -b feat/somefeature
cd ../my-repo-feature
npx worktree-up
```

Expected output:

```json
[worktree-up] Inspecting checkout from /path/to/my-repo-fix
[worktree-up] Current checkout: /path/to/my-repo-fix
[worktree-up] Source checkout: /path/to/my-repo
[worktree-up] Loaded configuration from /path/to/my-repo-fix/package.json
[worktree-up] Copied .env.local
[worktree-up] Copied .claude/settings.local.json
[worktree-up] Copy summary: 2 copied, 0 skipped.
[worktree-up] Running setup command: pnpm install
[worktree-up] Running setup command: pnpm db:generate
[worktree-up] Run summary: 2 command(s) completed.
[worktree-up] Finished.
```

## Behavior

- detects the current Git checkout root
- finds the repository's source checkout from Git worktree metadata
- loads config from `worktree-up.json` or `package.json`
- copies matched files and symlinks without overwriting anything already present
- runs configured setup commands sequentially in the current worktree

## Copy rules

- `copy` entries are glob patterns resolved from the source checkout root
- regular files and symlinks are copied
- directories are not copied as standalone entries
- existing paths in the target worktree are skipped and never overwritten
- patterns that match nothing are logged as warnings
- patterns cannot use absolute paths or `..` traversal outside the repo root
