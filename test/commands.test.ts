import { describe, expect, it, vi } from 'vitest';

import { runSetupCommands } from '../src/commands.js';
import type { Logger } from '../src/types.js';

describe('runSetupCommands', () => {
  it('runs commands sequentially in the target directory', async () => {
    const calls: Array<{ command: string; cwd: string }> = [];
    const logger: Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    await runSetupCommands(
      ['pnpm install', 'pnpm db:generate'],
      '/repo-linked',
      logger,
      async (command, cwd) => {
        calls.push({ command, cwd });
      }
    );

    expect(calls).toEqual([
      { command: 'pnpm install', cwd: '/repo-linked' },
      { command: 'pnpm db:generate', cwd: '/repo-linked' }
    ]);
    expect(logger.info).toHaveBeenCalledTimes(2);
  });
});
