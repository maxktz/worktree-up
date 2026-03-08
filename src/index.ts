import { runSetupCommands } from './commands.js';
import { loadWorktreeUpConfig } from './config.js';
import { createCopyPlan, executeCopyPlan } from './copy.js';
import { detectCheckoutContext } from './git.js';
import { ConsoleLogger } from './logger.js';
import type { Logger } from './types.js';

export interface RunWorktreeUpOptions {
  cwd?: string;
  logger?: Logger;
}

export async function runWorktreeUp(options: RunWorktreeUpOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const logger = options.logger ?? new ConsoleLogger();

  logger.info(`Inspecting checkout from ${cwd}`);
  const checkoutContext = await detectCheckoutContext(cwd);
  logger.info(`Current checkout: ${checkoutContext.currentRoot}`);
  logger.info(`Source checkout: ${checkoutContext.sourceRoot}`);

  const { configPath, config } = await loadWorktreeUpConfig(checkoutContext.currentRoot);
  logger.info(`Loaded configuration from ${configPath}`);

  if (config.copy.length === 0) {
    logger.info('No copy patterns configured.');
  } else {
    const copyPlan = await createCopyPlan(
      checkoutContext.sourceRoot,
      checkoutContext.currentRoot,
      config.copy
    );

    for (const pattern of copyPlan.unmatchedPatterns) {
      logger.warn(`Pattern matched no files: ${pattern}`);
    }

    if (copyPlan.operations.length === 0) {
      logger.info('No files matched the configured copy patterns.');
    } else {
      const copyResult = await executeCopyPlan(copyPlan, logger);
      logger.info(`Copy summary: ${copyResult.copied.length} copied, ${copyResult.skipped.length} skipped.`);
    }
  }

  if (config.run.length === 0) {
    logger.info('No setup commands configured.');
  } else {
    await runSetupCommands(config.run, checkoutContext.currentRoot, logger);
    logger.info(`Run summary: ${config.run.length} command(s) completed.`);
  }

  logger.info('Finished.');
}
