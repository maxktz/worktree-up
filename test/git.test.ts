import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  detectCheckoutContext,
  parseWorktreeListPorcelain,
  resolveGitPath,
  resolveSourceRoot
} from '../src/git.js';

describe('parseWorktreeListPorcelain', () => {
  it('parses worktree entries and bare state', () => {
    const output = [
      'worktree /repo',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      'worktree /repo-linked',
      'HEAD def456',
      'detached',
      '',
      'worktree /repo-bare',
      'bare',
      ''
    ].join('\n');

    expect(parseWorktreeListPorcelain(output)).toEqual([
      { path: '/repo', bare: false },
      { path: '/repo-linked', bare: false },
      { path: '/repo-bare', bare: true }
    ]);
  });
});

describe('resolveGitPath', () => {
  it('resolves relative git paths from the current root', () => {
    expect(resolveGitPath('/repo/worktree', '../.git')).toBe(path.resolve('/repo/.git'));
  });
});

describe('resolveSourceRoot', () => {
  it('prefers the primary checkout when current root is a linked worktree', () => {
    expect(
      resolveSourceRoot('/repo-linked', '/repo/.git', [
        { path: '/repo', bare: false },
        { path: '/repo-linked', bare: false }
      ])
    ).toBe(path.resolve('/repo'));
  });

  it('stays on the current root when already running in the primary checkout', () => {
    expect(
      resolveSourceRoot('/repo', '/repo/.git', [
        { path: '/repo', bare: false },
        { path: '/repo-linked', bare: false }
      ])
    ).toBe(path.resolve('/repo'));
  });
});

describe('detectCheckoutContext', () => {
  it('builds checkout context from git commands', async () => {
    const responses = new Map<string, string>([
      ['rev-parse --path-format=absolute --show-toplevel', '/repo-linked'],
      ['rev-parse --path-format=absolute --git-common-dir', '/repo/.git'],
      [
        'worktree list --porcelain',
        ['worktree /repo', 'HEAD abc123', '', 'worktree /repo-linked', 'HEAD def456', ''].join('\n')
      ]
    ]);

    const gitRunner = async (args: string[]) => {
      const key = args.join(' ');
      const response = responses.get(key);

      if (!response) {
        throw new Error(`Unexpected git command: ${key}`);
      }

      return response;
    };

    await expect(detectCheckoutContext('/repo-linked', gitRunner)).resolves.toEqual({
      currentRoot: '/repo-linked',
      commonGitDir: '/repo/.git',
      sourceRoot: '/repo'
    });
  });
});
