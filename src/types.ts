export interface WorktreeUpConfig {
  copy: string[];
  run: string[];
}

export interface WorktreeEntry {
  path: string;
  bare: boolean;
}

export interface CheckoutContext {
  currentRoot: string;
  sourceRoot: string;
  commonGitDir: string;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface CopyOperation {
  relativePath: string;
  sourcePath: string;
  destinationPath: string;
}

export interface CopyPlan {
  operations: CopyOperation[];
  unmatchedPatterns: string[];
}

export interface CopyResult {
  copied: string[];
  skipped: string[];
}

export type GitRunner = (args: string[], cwd: string) => Promise<string>;

export type ShellRunner = (command: string, cwd: string) => Promise<void>;
