import type { Logger } from './types.js';

const PREFIX = '[worktree-up]';

export class ConsoleLogger implements Logger {
  info(message: string): void {
    console.log(`${PREFIX} ${message}`);
  }

  warn(message: string): void {
    console.warn(`${PREFIX} ${message}`);
  }

  error(message: string): void {
    console.error(`${PREFIX} ${message}`);
  }
}
