// Compatibility helpers for both Modal and Daytona sandbox providers
import type { Sandbox } from "@daytonaio/sdk";
import {
  executeCommand as modalExecuteCommand,
  readFile as modalReadFile,
  writeFile as modalWriteFile,
} from "./modal-sandbox-manager.js";

// Minimal typed shape for command execution results from Daytona
export interface DaytonaExecutionResult {
  result?: string; // Standard output from executeCommand
  output?: string; // legacy codeRun output field
  stdout?: string; // For compatibility
  stderr?: string; // For compatibility
  exitCode?: number;
  artifacts?: {
    stdout?: string;
    stderr?: string;
    charts?: any;
  };
}

export interface CommandOptions {
  timeoutMs?: number;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  cwd?: string;
}

/**
 * Execute a shell/command in either Modal or Daytona sandbox.
 * Accepts either a Daytona Sandbox object or a Modal sandboxId string.
 */
export async function runCommandOnSandbox(
  sandbox: Sandbox | string,
  command: string,
  options?: CommandOptions
): Promise<DaytonaExecutionResult> {
  if (!sandbox) throw new Error("Sandbox not found");
  
  // Handle Modal sandbox (sandboxId as string)
  if (typeof sandbox === 'string') {
    try {
      const result = await modalExecuteCommand(sandbox, command, {
        timeoutMs: options?.timeoutMs || 30000,
      });
      
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || 0,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // Check for Modal-specific errors
      if (errorMsg.includes('already completed') || errorMsg.includes('expired')) {
        throw new Error(`Modal sandbox ${sandbox} is no longer active. Please recreate the sandbox.`);
      }
      throw error;
    }
  }

  const execute = async (): Promise<DaytonaExecutionResult> => {
    // Primary: modern Daytona executeCommand
    if (
      sandbox.process &&
      typeof sandbox.process.executeCommand === "function"
    ) {
      const res: any = await sandbox.process.executeCommand(command);

      // Normalize the response format
      const normalized: DaytonaExecutionResult = {
        exitCode: res.exitCode,
        result: res.result,
        // Map result to stdout for compatibility with validation code
        stdout: res.result || res.artifacts?.stdout,
        stderr: res.artifacts?.stderr,
        artifacts: res.artifacts,
      };

      if (options?.onStdout && normalized.stdout) {
        normalized.stdout
          .split(/\r?\n/)
          .forEach((l: string) => l && options.onStdout!(l));
      }
      if (options?.onStderr && normalized.stderr) {
        normalized.stderr
          .split(/\r?\n/)
          .forEach((l: string) => l && options.onStderr!(l));
      }

      return normalized;
    }

    // Fallback: legacy codeRun (used by manager)
    if (sandbox.process && typeof sandbox.process.codeRun === "function") {
      const res: any = await sandbox.process.codeRun(command);
      if (options?.onStdout && res?.output) {
        res.output
          .split(/\r?\n/)
          .forEach((l: string) => l && options.onStdout!(l));
      }
      return {
        output: res.output,
        stdout: res.output, // Normalize for compatibility
        result: res.output,
      };
    }

    // Final fallback through direct SDK call
    const res: any = await sandbox.process.executeCommand(command);
    const normalized: DaytonaExecutionResult = {
      exitCode: res.exitCode,
      result: res.result,
      stdout: res.result || res.artifacts?.stdout,
      stderr: res.artifacts?.stderr,
      artifacts: res.artifacts,
    };

    if (options?.onStdout && normalized.stdout) {
      normalized.stdout
        .split(/\r?\n/)
        .forEach((l: string) => l && options.onStdout!(l));
    }
    return normalized;
  };

  if (!options?.timeoutMs) return execute();

  return await Promise.race([
    execute(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Command timed out after ${options.timeoutMs}ms: ${command}`
            )
          ),
        options.timeoutMs
      )
    ),
  ]);
}

/**
 * Read a file from either Modal or Daytona sandbox
 */
export async function readFileFromSandbox(
  sandbox: Sandbox | string,
  path: string
): Promise<string> {
  if (!sandbox) throw new Error("Sandbox not found");
  
  // Handle Modal sandbox (sandboxId as string)
  if (typeof sandbox === 'string') {
    const content = await modalReadFile(sandbox, path);
    return content;
  }

  // Try using absolute path to workspace
  const workspacePath = `/home/daytona/workspace/${path}`;
  if (sandbox.fs && typeof sandbox.fs.downloadFile === "function") {
    const result = await sandbox.fs.downloadFile(workspacePath);
    return Buffer.isBuffer(result) ? result.toString() : String(result);
  }

  throw new Error("No Daytona fs.downloadFile API available on sandbox");
}

/**
 * Write a string file into a Daytona sandbox using the SDK FS API.
 */
export async function writeFileToSandbox(
  sandbox: Sandbox | string,
  path: string,
  content: string
): Promise<void> {
  if (!sandbox) throw new Error("Sandbox not found");
  
  // Handle Modal sandbox (sandboxId as string)
  if (typeof sandbox === 'string') {
    await modalWriteFile(sandbox, path, content);
    return;
  }

  // Try using absolute path to workspace
  const workspacePath = `/home/daytona/workspace/${path}`;
  if (sandbox.fs && typeof sandbox.fs.uploadFile === "function") {
    await sandbox.fs.uploadFile(Buffer.from(content), workspacePath);
    return;
  }

  throw new Error("No Daytona fs.uploadFile API available on sandbox");
}

export default { runCommandOnSandbox, readFileFromSandbox, writeFileToSandbox };
