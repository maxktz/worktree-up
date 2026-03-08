# worktree-up

`worktree-up` copies local setup files from a repository's main checkout into the current Git worktree, then runs repository-defined setup commands.

## Usage

### 1. Add config

Put this in your main repository checkout (not the worktree):

If using `package.json`, add this to the root `package.json`:

```jsonc
{
  /** ...rest of your package.json */
  "worktree-up": {
    "copy": ["**/.env.local", "**/.env", "**/settings.local.json"],
    "run": ["pnpm install", "pnpm db:generate"],
  },
}
```

Or create a repo root `worktree-up.json` (works for non-JS repos):

```json
{
  "copy": ["**/.env.local", "**/.env", "**/settings.local.json"],
  "run": ["mise install", "just bootstrap"]
}
```

> Committing the config is not necessary if it already exists in your main checkout on disk. `worktree-up` reads config from the source/main checkout first.

> [!IMPORTANT]
> Both `worktree-up.json` and config in `package.json` cannot exist, only use single

### 2. Create a git worktree

From your main checkout:

```bash
git worktree add ../my-repo-feature -b feat/somefeature
cd ../my-repo-feature
```

### 3. Run `worktree-up`

```bash
npx -y worktree-up
```

`worktree-up` sees your source/main tree automaitcally and will copy files from it.

Expected output:

```
[worktree-up] Inspecting checkout from ~/my-repo-feature
[worktree-up] Current checkout: ~/my-repo-feature
[worktree-up] Source checkout: ~/my-repo
[worktree-up] Loaded configuration from ~/my-repo/package.json
[worktree-up] Copied .env.local
[worktree-up] Copied .claude/settings.local.json
[worktree-up] Copy summary: 2 copied, 0 skipped.
[worktree-up] Running setup command: pnpm install
[worktree-up] Run summary: 2 command(s) completed.
[worktree-up] Finished.
```

> That's it!

## Behavior

- detects the current Git checkout root
- finds the repository's source checkout from Git worktree metadata
- loads config from the source/main checkout first, then falls back to the current worktree
- supports `worktree-up.json` or `package.json`
- copies matched files and symlinks without overwriting anything already present
- runs configured setup commands sequentially in the current worktree

## Copy rules

- `copy` entries are glob patterns resolved from the source checkout root
- regular files and symlinks are copied
- directories are not copied as standalone entries
- existing paths in the target worktree are skipped and never overwritten
- patterns that match nothing are logged as warnings
- patterns cannot use absolute paths or `..` traversal outside the repo root
