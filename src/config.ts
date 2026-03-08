import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { UserError } from './errors.js';
import type { WorktreeUpConfig } from './types.js';

const traversalSegmentPattern = /(^|[\\/])\.\.([\\/]|$)/;

function isSafeRelativePattern(pattern: string): boolean {
  const normalized = pattern.replaceAll('\\', '/');

  return (
    !path.posix.isAbsolute(normalized) &&
    !path.win32.isAbsolute(pattern) &&
    !traversalSegmentPattern.test(normalized)
  );
}

const copyPatternSchema = z
  .string()
  .trim()
  .min(1, 'Copy patterns must not be empty.')
  .refine(isSafeRelativePattern, {
    message: 'Copy patterns must stay within the repository root.'
  });

const commandSchema = z.string().trim().min(1, 'Run commands must not be empty.');

const worktreeUpConfigSchema = z
  .object({
    copy: z.array(copyPatternSchema).default([]),
    run: z.array(commandSchema).default([])
  })
  .strict()
  .refine((value) => value.copy.length > 0 || value.run.length > 0, {
    message: 'Configure at least one copy pattern or one run command.'
  });

export function parseWorktreeUpConfig(value: unknown): WorktreeUpConfig {
  const result = worktreeUpConfigSchema.safeParse(value);

  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message).join(' ');
    throw new UserError(`Invalid "worktree-up" configuration. ${details}`);
  }

  return result.data;
}

async function tryReadJsonFile(filePath: string): Promise<unknown | undefined> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === 'ENOENT') {
      return undefined;
    }

    throw new UserError(`Failed to parse ${filePath} as JSON.`);
  }
}

export async function loadWorktreeUpConfig(
  repoRoot: string
): Promise<{ configPath: string; config: WorktreeUpConfig }> {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const standaloneConfigPath = path.join(repoRoot, 'worktree-up.json');

  const [packageJsonValue, standaloneConfigValue] = await Promise.all([
    tryReadJsonFile(packageJsonPath),
    tryReadJsonFile(standaloneConfigPath)
  ]);

  const packageJson =
    packageJsonValue && typeof packageJsonValue === 'object'
      ? (packageJsonValue as Record<string, unknown>)
      : undefined;
  const packageJsonConfig = packageJson?.['worktree-up'];

  if (packageJsonConfig !== undefined && standaloneConfigValue !== undefined) {
    throw new UserError(
      `Found configuration in both ${standaloneConfigPath} and ${packageJsonPath}. Keep only one.`
    );
  }

  if (standaloneConfigValue !== undefined) {
    return {
      configPath: standaloneConfigPath,
      config: parseWorktreeUpConfig(standaloneConfigValue)
    };
  }

  if (packageJsonConfig !== undefined) {
    return {
      configPath: packageJsonPath,
      config: parseWorktreeUpConfig(packageJsonConfig)
    };
  }

  throw new UserError(
    `Missing configuration. Add "worktree-up" to ${packageJsonPath} or create ${standaloneConfigPath}.`
  );
}
