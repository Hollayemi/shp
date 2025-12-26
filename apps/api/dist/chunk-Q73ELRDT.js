import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  executeCommand,
  readFile,
  writeFile
} from "./chunk-IDZAZ4YU.js";
import {
  init_esm_shims
} from "./chunk-IXOW5DJO.js";

// src/services/sandbox-compat.ts
init_esm_shims();
async function runCommandOnSandbox(sandbox, command, options) {
  if (!sandbox) throw new Error("Sandbox not found");
  if (typeof sandbox === "string") {
    try {
      const result = await executeCommand(sandbox, command, {
        timeoutMs: options?.timeoutMs || 3e4
      });
      return {
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode || 0
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("already completed") || errorMsg.includes("expired")) {
        throw new Error(`Modal sandbox ${sandbox} is no longer active. Please recreate the sandbox.`);
      }
      throw error;
    }
  }
  const execute = async () => {
    if (sandbox.process && typeof sandbox.process.executeCommand === "function") {
      const res2 = await sandbox.process.executeCommand(command);
      const normalized2 = {
        exitCode: res2.exitCode,
        result: res2.result,
        // Map result to stdout for compatibility with validation code
        stdout: res2.result || res2.artifacts?.stdout,
        stderr: res2.artifacts?.stderr,
        artifacts: res2.artifacts
      };
      if (options?.onStdout && normalized2.stdout) {
        normalized2.stdout.split(/\r?\n/).forEach((l) => l && options.onStdout(l));
      }
      if (options?.onStderr && normalized2.stderr) {
        normalized2.stderr.split(/\r?\n/).forEach((l) => l && options.onStderr(l));
      }
      return normalized2;
    }
    if (sandbox.process && typeof sandbox.process.codeRun === "function") {
      const res2 = await sandbox.process.codeRun(command);
      if (options?.onStdout && res2?.output) {
        res2.output.split(/\r?\n/).forEach((l) => l && options.onStdout(l));
      }
      return {
        output: res2.output,
        stdout: res2.output,
        // Normalize for compatibility
        result: res2.output
      };
    }
    const res = await sandbox.process.executeCommand(command);
    const normalized = {
      exitCode: res.exitCode,
      result: res.result,
      stdout: res.result || res.artifacts?.stdout,
      stderr: res.artifacts?.stderr,
      artifacts: res.artifacts
    };
    if (options?.onStdout && normalized.stdout) {
      normalized.stdout.split(/\r?\n/).forEach((l) => l && options.onStdout(l));
    }
    return normalized;
  };
  if (!options?.timeoutMs) return execute();
  return await Promise.race([
    execute(),
    new Promise(
      (_, reject) => setTimeout(
        () => reject(
          new Error(
            `Command timed out after ${options.timeoutMs}ms: ${command}`
          )
        ),
        options.timeoutMs
      )
    )
  ]);
}
async function readFileFromSandbox(sandbox, path) {
  if (!sandbox) throw new Error("Sandbox not found");
  if (typeof sandbox === "string") {
    const content = await readFile(sandbox, path);
    return content;
  }
  const workspacePath = `/home/daytona/workspace/${path}`;
  if (sandbox.fs && typeof sandbox.fs.downloadFile === "function") {
    const result = await sandbox.fs.downloadFile(workspacePath);
    return Buffer.isBuffer(result) ? result.toString() : String(result);
  }
  throw new Error("No Daytona fs.downloadFile API available on sandbox");
}
async function writeFileToSandbox(sandbox, path, content) {
  if (!sandbox) throw new Error("Sandbox not found");
  if (typeof sandbox === "string") {
    await writeFile(sandbox, path, content);
    return;
  }
  const workspacePath = `/home/daytona/workspace/${path}`;
  if (sandbox.fs && typeof sandbox.fs.uploadFile === "function") {
    await sandbox.fs.uploadFile(Buffer.from(content), workspacePath);
    return;
  }
  throw new Error("No Daytona fs.uploadFile API available on sandbox");
}
var sandbox_compat_default = { runCommandOnSandbox, readFileFromSandbox, writeFileToSandbox };

export {
  runCommandOnSandbox,
  readFileFromSandbox,
  writeFileToSandbox,
  sandbox_compat_default
};
