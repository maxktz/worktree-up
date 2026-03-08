import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadWorktreeUpConfig, parseWorktreeUpConfig } from '../src/config.js';
import { UserError } from '../src/errors.js';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('parseWorktreeUpConfig', () => {
  it('accepts a valid config object', () => {
    expect(
      parseWorktreeUpConfig({
        copy: ['.env.local', '**/.env.local'],
        run: ['pnpm install']
      })
    ).toEqual({
      copy: ['.env.local', '**/.env.local'],
      run: ['pnpm install']
    });
  });

  it('rejects path traversal patterns', () => {
    expect(() => parseWorktreeUpConfig({ copy: ['../.env'], run: [] })).toThrow(UserError);
  });

  it('requires at least one action', () => {
    expect(() => parseWorktreeUpConfig({ copy: [], run: [] })).toThrow(UserError);
  });
});

describe('loadWorktreeUpConfig', () => {
  it('loads config from package.json', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-config-'));
    tempDirectories.push(repoRoot);

    await writeFile(
      path.join(repoRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'fixture',
          'worktree-up': {
            copy: ['.env.local'],
            run: ['pnpm install']
          }
        },
        null,
        2
      )
    );

    const loaded = await loadWorktreeUpConfig(repoRoot);
    expect(loaded.config).toEqual({
      copy: ['.env.local'],
      run: ['pnpm install']
    });
  });

  it('loads config from worktree-up.json for non-node repos', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-json-config-'));
    tempDirectories.push(repoRoot);

    await writeFile(
      path.join(repoRoot, 'worktree-up.json'),
      JSON.stringify(
        {
          copy: ['.env.local'],
          run: ['mise install']
        },
        null,
        2
      )
    );

    const loaded = await loadWorktreeUpConfig(repoRoot);
    expect(loaded.configPath).toBe(path.join(repoRoot, 'worktree-up.json'));
    expect(loaded.config).toEqual({
      copy: ['.env.local'],
      run: ['mise install']
    });
  });

  it('rejects ambiguous config when both sources exist', async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-ambiguous-config-'));
    tempDirectories.push(repoRoot);

    await writeFile(
      path.join(repoRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'fixture',
          'worktree-up': {
            copy: ['.env.local'],
            run: []
          }
        },
        null,
        2
      )
    );
    await writeFile(
      path.join(repoRoot, 'worktree-up.json'),
      JSON.stringify(
        {
          copy: ['.env.local'],
          run: []
        },
        null,
        2
      )
    );

    await expect(loadWorktreeUpConfig(repoRoot)).rejects.toThrow(UserError);
  });

  it('prefers config from the source checkout over the current worktree', async () => {
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-source-config-'));
    const worktreeRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-worktree-config-'));
    tempDirectories.push(sourceRoot, worktreeRoot);

    await writeFile(
      path.join(sourceRoot, 'worktree-up.json'),
      JSON.stringify(
        {
          copy: ['source.env'],
          run: ['pnpm install']
        },
        null,
        2
      )
    );
    await writeFile(
      path.join(worktreeRoot, 'worktree-up.json'),
      JSON.stringify(
        {
          copy: ['worktree.env'],
          run: ['pnpm install']
        },
        null,
        2
      )
    );

    const loaded = await loadWorktreeUpConfig([sourceRoot, worktreeRoot]);
    expect(loaded.configPath).toBe(path.join(sourceRoot, 'worktree-up.json'));
    expect(loaded.config).toEqual({
      copy: ['source.env'],
      run: ['pnpm install']
    });
  });

  it('falls back to the current worktree when the source checkout has no config', async () => {
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-source-empty-'));
    const worktreeRoot = await mkdtemp(path.join(os.tmpdir(), 'worktree-up-worktree-fallback-'));
    tempDirectories.push(sourceRoot, worktreeRoot);

    await writeFile(
      path.join(worktreeRoot, 'worktree-up.json'),
      JSON.stringify(
        {
          copy: ['fallback.env'],
          run: ['mise install']
        },
        null,
        2
      )
    );

    const loaded = await loadWorktreeUpConfig([sourceRoot, worktreeRoot]);
    expect(loaded.configPath).toBe(path.join(worktreeRoot, 'worktree-up.json'));
    expect(loaded.config).toEqual({
      copy: ['fallback.env'],
      run: ['mise install']
    });
  });
});
