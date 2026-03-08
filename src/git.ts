import path from 'node:path';

import { execa } from 'execa';

import { UserError } from './errors.js';
import type { CheckoutContext, GitRunner, WorktreeEntry } from './types.js';

export async function runGitCommand(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execa('git', args, { cwd });
  return stdout.trim();
}

export function parseWorktreeListPorcelain(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let currentEntry: WorktreeEntry | undefined;

  const flush = (): void => {
    if (currentEntry) {
      entries.push(currentEntry);
      currentEntry = undefined;
    }
  };

  for (const line of output.split(/\r?\n/)) {
    if (line.length === 0) {
      flush();
      continue;
    }

    if (line.startsWith('worktree ')) {
      flush();
      currentEntry = {
        path: line.slice('worktree '.length),
        bare: false
      };
      continue;
    }

    if (line === 'bare' && currentEntry) {
      currentEntry.bare = true;
    }
  }

  flush();
  return entries;
}

export function resolveGitPath(currentRoot: string, gitPath: string): string {
  return path.isAbsolute(gitPath) ? path.resolve(gitPath) : path.resolve(currentRoot, gitPath);
}

export function resolveSourceRoot(
  currentRoot: string,
  commonGitDir: string,
  entries: WorktreeEntry[]
): string {
  const normalizedCurrentRoot = path.resolve(currentRoot);
  const normalizedEntries = entries
    .filter((entry) => !entry.bare)
    .map((entry) => path.resolve(entry.path));

  const primaryCandidate =
    path.basename(commonGitDir) === '.git' ? path.resolve(path.dirname(commonGitDir)) : undefined;

  if (primaryCandidate && normalizedEntries.includes(primaryCandidate)) {
    return primaryCandidate;
  }

  return normalizedEntries.find((entry) => entry !== normalizedCurrentRoot) ?? normalizedCurrentRoot;
}

export async function detectCheckoutContext(
  cwd: string,
  gitRunner: GitRunner = runGitCommand
): Promise<CheckoutContext> {
  try {
    const currentRoot = path.resolve(
      await gitRunner(['rev-parse', '--path-format=absolute', '--show-toplevel'], cwd)
    );
    const commonGitDir = path.resolve(
      await gitRunner(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd)
    );
    const entries = parseWorktreeListPorcelain(
      await gitRunner(['worktree', 'list', '--porcelain'], cwd)
    );

    return {
      currentRoot,
      commonGitDir,
      sourceRoot: resolveSourceRoot(currentRoot, commonGitDir, entries)
    };
  } catch (error) {
    throw new UserError(
      'worktree-up must be run inside a Git checkout with worktree metadata available.'
    );
  }
}
