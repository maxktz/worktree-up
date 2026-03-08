import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readlink, stat, symlink } from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';

import type { CopyPlan, CopyResult, Logger } from './types.js';

const FAST_GLOB_IGNORE = ['.git/**'];

interface GlobMatch {
  path: string;
  dirent?: {
    isFile(): boolean;
    isSymbolicLink(): boolean;
  };
}

function isCopyableMatch(match: GlobMatch): boolean {
  return match.dirent?.isFile() === true || match.dirent?.isSymbolicLink() === true;
}

async function detectSymlinkType(
  sourcePath: string,
  linkTarget: string
): Promise<'dir' | 'file' | undefined> {
  try {
    const targetStats = await stat(path.resolve(path.dirname(sourcePath), linkTarget));
    return targetStats.isDirectory() ? 'dir' : 'file';
  } catch {
    return undefined;
  }
}

export async function createCopyPlan(
  sourceRoot: string,
  currentRoot: string,
  patterns: string[]
): Promise<CopyPlan> {
  const operations = [];
  const unmatchedPatterns: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const matches = (await fg(pattern, {
      cwd: sourceRoot,
      dot: true,
      onlyFiles: false,
      onlyDirectories: false,
      unique: true,
      followSymbolicLinks: false,
      objectMode: true,
      ignore: FAST_GLOB_IGNORE
    })) as GlobMatch[];

    const copyableMatches = matches.filter(isCopyableMatch);

    if (copyableMatches.length === 0) {
      unmatchedPatterns.push(pattern);
      continue;
    }

    copyableMatches.sort((left, right) => left.path.localeCompare(right.path));

    for (const { path: relativePath } of copyableMatches) {
      if (seen.has(relativePath)) {
        continue;
      }

      seen.add(relativePath);
      operations.push({
        relativePath,
        sourcePath: path.join(sourceRoot, relativePath),
        destinationPath: path.join(currentRoot, relativePath)
      });
    }
  }

  operations.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return { operations, unmatchedPatterns };
}

export async function executeCopyPlan(plan: CopyPlan, logger: Logger): Promise<CopyResult> {
  const copied: string[] = [];
  const skipped: string[] = [];

  for (const operation of plan.operations) {
    if (path.resolve(operation.sourcePath) === path.resolve(operation.destinationPath)) {
      skipped.push(operation.relativePath);
      logger.info(`Skipping ${operation.relativePath} because the source and destination are the same checkout.`);
      continue;
    }

    await mkdir(path.dirname(operation.destinationPath), { recursive: true });

    try {
      const sourceStats = await lstat(operation.sourcePath);

      if (sourceStats.isSymbolicLink()) {
        const linkTarget = await readlink(operation.sourcePath);
        const linkType = await detectSymlinkType(operation.sourcePath, linkTarget);
        await symlink(linkTarget, operation.destinationPath, linkType);
        copied.push(operation.relativePath);
        logger.info(`Copied symlink ${operation.relativePath}`);
        continue;
      }

      if (!sourceStats.isFile()) {
        skipped.push(operation.relativePath);
        logger.warn(`Skipping ${operation.relativePath} because it is no longer a file or symlink.`);
        continue;
      }

      await copyFile(operation.sourcePath, operation.destinationPath, constants.COPYFILE_EXCL);
      copied.push(operation.relativePath);
      logger.info(`Copied ${operation.relativePath}`);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;

      if (nodeError.code === 'EEXIST') {
        skipped.push(operation.relativePath);
        logger.info(`Skipping ${operation.relativePath} because it already exists.`);
        continue;
      }

      throw error;
    }
  }

  return { copied, skipped };
}
