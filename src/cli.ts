#!/usr/bin/env node
import { UserError } from './errors.js';
import { ConsoleLogger } from './logger.js';
import { runWorktreeUp } from './index.js';

const logger = new ConsoleLogger();

try {
  await runWorktreeUp({ logger });
} catch (error) {
  if (error instanceof UserError) {
    logger.error(error.message);
  } else if (error instanceof Error) {
    logger.error(error.message);
  } else {
    logger.error('An unknown error occurred.');
  }

  process.exitCode = 1;
}
