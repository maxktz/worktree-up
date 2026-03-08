import { lstatSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCopyPlan, executeCopyPlan } from '../src/copy.js';
import { ConsoleLogger } from '../src/logger.js';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('copy workflow', () => {
  it('copies matched files and skips existing ones', async () => {
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-source-'));
    const currentRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-current-'));
    tempDirectories.push(sourceRoot, currentRoot);

    await mkdir(path.join(sourceRoot, '.vscode'), { recursive: true });
    await mkdir(path.join(sourceRoot, 'packages', 'app'), { recursive: true });

    await writeFile(path.join(sourceRoot, '.env.local'), 'SOURCE_ENV=1\n');
    await writeFile(path.join(sourceRoot, '.vscode', 'settings.json'), '{"editor.tabSize":2}\n');
    await writeFile(path.join(sourceRoot, 'packages', 'app', '.env.local'), 'NESTED_ENV=1\n');
    await writeFile(path.join(currentRoot, '.env.local'), 'EXISTING_ENV=1\n');

    const plan = await createCopyPlan(sourceRoot, currentRoot, [
      '.env.local',
      '**/.env.local',
      '.vscode/settings.json',
      'missing.file'
    ]);

    expect(plan.unmatchedPatterns).toEqual(['missing.file']);
    expect(plan.operations.map((operation) => operation.relativePath)).toEqual([
      '.env.local',
      '.vscode/settings.json',
      'packages/app/.env.local'
    ]);

    const logger = new ConsoleLogger();
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    const result = await executeCopyPlan(plan, logger);

    expect(result).toEqual({
      copied: ['.vscode/settings.json', 'packages/app/.env.local'],
      skipped: ['.env.local']
    });

    expect(await readFile(path.join(currentRoot, '.env.local'), 'utf8')).toBe('EXISTING_ENV=1\n');
    expect(await readFile(path.join(currentRoot, '.vscode', 'settings.json'), 'utf8')).toBe(
      '{"editor.tabSize":2}\n'
    );
    expect(await readFile(path.join(currentRoot, 'packages', 'app', '.env.local'), 'utf8')).toBe(
      'NESTED_ENV=1\n'
    );

    expect(infoSpy).toHaveBeenCalled();
  });

  it('skips files when source and destination are the same path', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-same-root-'));
    tempDirectories.push(repoRoot);

    await writeFile(path.join(repoRoot, '.env.local'), 'VALUE=1\n');

    const plan = await createCopyPlan(repoRoot, repoRoot, ['.env.local']);
    const logger = new ConsoleLogger();
    const result = await executeCopyPlan(plan, logger);

    expect(result).toEqual({
      copied: [],
      skipped: ['.env.local']
    });
  });

  it('copies symlinks as symlinks', async () => {
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-source-link-'));
    const currentRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-current-link-'));
    tempDirectories.push(sourceRoot, currentRoot);

    await writeFile(path.join(sourceRoot, 'shared.env'), 'SOURCE_ENV=1\n');
    await symlink('shared.env', path.join(sourceRoot, '.env.local'));

    const plan = await createCopyPlan(sourceRoot, currentRoot, ['.env.local']);
    const logger = new ConsoleLogger();
    const result = await executeCopyPlan(plan, logger);

    expect(result).toEqual({
      copied: ['.env.local'],
      skipped: []
    });
    expect(lstatSync(path.join(currentRoot, '.env.local')).isSymbolicLink()).toBe(true);
    expect(await readlink(path.join(currentRoot, '.env.local'))).toBe('shared.env');
    expect(await readFile(path.join(currentRoot, 'shared.env'), 'utf8').catch(() => null)).toBeNull();
  });
});
