import { execa } from 'execa';

import type { Logger, ShellRunner } from './types.js';

export async function runShellCommand(command: string, cwd: string): Promise<void> {
  await execa(command, {
    cwd,
    shell: true,
    stdio: 'inherit',
    preferLocal: true
  });
}

export async function runSetupCommands(
  commands: string[],
  cwd: string,
  logger: Logger,
  shellRunner: ShellRunner = runShellCommand
): Promise<void> {
  for (const command of commands) {
    logger.info(`Running setup command: ${command}`);
    await shellRunner(command, cwd);
  }
}
