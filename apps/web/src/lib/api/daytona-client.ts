/**
 * Daytona API Client
 *
 * Client for communicating with the Daytona API server.
 * This replaces direct SDK usage in the webapp.
 */

import type { Sandbox } from "@daytonaio/sdk";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SHIPPER_API_KEY = process.env.SHIPPER_API_KEY;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DaytonaSandboxInfo {
  sandboxId: string;
  sandboxUrl: string;
  sandboxExpiresAt?: Date | null;
  gitRepositoryUrl?: string;
  currentBranch?: string;
  gitCommitHash?: string;
}

export interface DaytonaExecutionResult {
  result?: string;
  output?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  artifacts?: {
    stdout?: string;
    stderr?: string;
    charts?: any;
  };
}

export interface PlaywrightCheckResult {
  success: boolean;
  errors: any[];
  totalErrors: number;
  timestamp: string;
  error?: string;
}

export interface CommandOptions {
  timeoutMs?: number;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  cwd?: string;
}

class DaytonaAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    console.log(`[DaytonaClient] Initialized with baseUrl: ${this.baseUrl}`);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1/daytona${endpoint}`;
    const method = options.method || 'GET';

    console.log(`[DaytonaClient] ${method} ${url} - Starting...`);

    if (!SHIPPER_API_KEY) {
      throw new Error("SHIPPER_API_KEY environment variable is not set");
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SHIPPER_API_KEY,
          ...options.headers,
        },
      });

      console.log(`[DaytonaClient] ${method} ${url} - Response status: ${response.status}`);

      const data: ApiResponse<T> = await response.json();

      if (!data.success) {
        console.error(`[DaytonaClient] ${method} ${url} - API Error:`, data.error);
        throw new Error(data.error || "API request failed");
      }

      console.log(`[DaytonaClient] ${method} ${url} - Success`);
      return data.data as T;
    } catch (error) {
      console.error(`[DaytonaClient] ${method} ${url} - Request failed:`, error);
      throw error;
    }
  }

  // Sandbox Management

  async getSandbox(projectId: string): Promise<DaytonaSandboxInfo | null> {
    try {
      return await this.request<DaytonaSandboxInfo>(`/sandbox/${projectId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  async createSandbox(
    projectId: string,
    fragmentId?: string | null,
    templateName?: string
  ): Promise<DaytonaSandboxInfo> {
    return await this.request<DaytonaSandboxInfo>("/sandbox", {
      method: "POST",
      body: JSON.stringify({ projectId, fragmentId, templateName }),
    });
  }

  async startSandbox(sandboxId: string): Promise<void> {
    await this.request("/sandbox/start", {
      method: "POST",
      body: JSON.stringify({ sandboxId }),
    });
  }

  async startDevServer(projectId: string, sandboxId: string): Promise<void> {
    await this.request("/sandbox/dev-server", {
      method: "POST",
      body: JSON.stringify({ projectId, sandboxId }),
    });
  }

  async deleteSandbox(sandboxId: string): Promise<void> {
    await this.request(`/sandbox/${sandboxId}`, {
      method: "DELETE",
    });
  }

  // Fragment & Git Operations

  async restoreV2Fragment(
    sandboxId: string,
    fragmentId: string,
    projectId: string
  ): Promise<void> {
    await this.request("/fragment/restore", {
      method: "POST",
      body: JSON.stringify({ sandboxId, fragmentId, projectId }),
    });
  }

  async createGitCommit(
    sandboxId: string,
    projectId: string,
    message: string,
    email: string,
    name: string
  ): Promise<string> {
    const result = await this.request<{ commitHash: string }>("/git/commit", {
      method: "POST",
      body: JSON.stringify({ sandboxId, projectId, message, email, name }),
    });
    return result.commitHash;
  }

  async switchToGitCommit(
    sandboxId: string,
    projectId: string,
    commitHash: string
  ): Promise<void> {
    await this.request("/git/switch", {
      method: "POST",
      body: JSON.stringify({ sandboxId, projectId, commitHash }),
    });
  }

  async restoreFiles(
    sandboxId: string,
    files: Record<string, string>
  ): Promise<void> {
    await this.request("/files/restore", {
      method: "POST",
      body: JSON.stringify({ sandboxId, files }),
    });
  }

  // File Operations

  async executeCommand(
    sandboxId: string,
    command: string,
    options?: CommandOptions
  ): Promise<DaytonaExecutionResult> {
    return await this.request<DaytonaExecutionResult>("/command/execute", {
      method: "POST",
      body: JSON.stringify({
        sandboxId,
        command,
        timeoutMs: options?.timeoutMs,
      }),
    });
  }

  async readFile(sandboxId: string, path: string): Promise<string> {
    const result = await this.request<{ content: string }>("/file/read", {
      method: "POST",
      body: JSON.stringify({ sandboxId, path }),
    });
    return result.content;
  }

  async writeFile(
    sandboxId: string,
    path: string,
    content: string
  ): Promise<void> {
    await this.request("/file/write", {
      method: "POST",
      body: JSON.stringify({ sandboxId, path, content }),
    });
  }

  async uploadMetadataImage(
    projectId: string,
    imageType: "icon" | "shareImage",
    base64Data: string,
    fileExtension: string
  ): Promise<{ path: string; filename: string; url: string }> {
    return await this.request<{ path: string; filename: string; url: string }>(
      "/metadata/upload-image",
      {
        method: "POST",
        body: JSON.stringify({ projectId, imageType, base64Data, fileExtension }),
      }
    );
  }

  async getMetadataImage(
    projectId: string,
    imageType: "icon" | "shareImage"
  ): Promise<{ dataUrl: string; mimeType: string; filename: string }> {
    return await this.request<{ dataUrl: string; mimeType: string; filename: string }>(
      `/metadata/get-image?projectId=${encodeURIComponent(projectId)}&imageType=${encodeURIComponent(imageType)}`,
      {
        method: "GET",
      }
    );
  }

  // Playwright Operations

  async runPlaywrightCheck(
    targetUrl: string,
    sandboxId?: string,
    maxRetries?: number
  ): Promise<PlaywrightCheckResult> {
    return await this.request<PlaywrightCheckResult>("/playwright/check", {
      method: "POST",
      body: JSON.stringify({ targetUrl, sandboxId, maxRetries }),
    });
  }

  async cleanupPlaywrightSandbox(): Promise<void> {
    await this.request("/playwright/cleanup", {
      method: "DELETE",
    });
  }

  async getPlaywrightSandboxStatus(): Promise<{
    exists: boolean;
    initialized: boolean;
    id?: string;
  }> {
    return await this.request("/playwright/status");
  }

  // Error Detection & Auto-Fix

  async detectHybridErrors(
    projectId: string,
    fragmentId?: string
  ): Promise<{
    errors: any;
    classification: any;
    fragmentId: string;
    fragmentTitle: string;
    analysisType: "hybrid" | "fragment-only";
    canAutoFix: boolean;
  }> {
    return await this.request("/errors/detect-hybrid", {
      method: "POST",
      body: JSON.stringify({ projectId, fragmentId }),
    });
  }

  async autoFixErrors(
    projectId: string,
    fragmentId?: string
  ): Promise<{
    fixResults: any[];
    summary: {
      totalErrors: number;
      successfulFixes: number;
      failedFixes: number;
      successRate: number;
    };
    newFragmentId: string | null;
    originalFragmentId: string;
  }> {
    return await this.request("/errors/auto-fix", {
      method: "POST",
      body: JSON.stringify({ projectId, fragmentId }),
    });
  }

  // Additional File Operations

  async listFiles(
    sandboxId: string
  ): Promise<Record<string, { size: number; modified: number }>> {
    const result = await this.request<{
      files: Record<string, { size: number; modified: number }>;
    }>("/files/list", {
      method: "POST",
      body: JSON.stringify({ sandboxId }),
    });
    return result.files;
  }

  async findFiles(sandboxId: string, pattern: string): Promise<string[]> {
    const result = await this.request<{ files: string[] }>("/files/find", {
      method: "POST",
      body: JSON.stringify({ sandboxId, pattern }),
    });
    return result.files;
  }

  async batchWriteFiles(
    sandboxId: string,
    files: Array<{ path: string; content: string }>
  ): Promise<Array<{ path: string; success: boolean; error?: string }>> {
    const result = await this.request<{
      results: Array<{ path: string; success: boolean; error?: string }>;
    }>("/files/batch-write", {
      method: "POST",
      body: JSON.stringify({ sandboxId, files }),
    });
    return result.results;
  }

  async replaceInFiles(
    sandboxId: string,
    replacements: Array<{ path: string; oldValue: string; newValue: string }>
  ): Promise<Array<{ path: string; success: boolean; error?: string }>> {
    const result = await this.request<{
      results: Array<{ path: string; success: boolean; error?: string }>;
    }>("/files/replace", {
      method: "POST",
      body: JSON.stringify({ sandboxId, replacements }),
    });
    return result.results;
  }

  async installPackages(
    sandboxId: string,
    packages: string[],
    dev?: boolean
  ): Promise<{
    packageManager: string;
    command: string;
    output: string;
    packages: string[];
  }> {
    return await this.request("/packages/install", {
      method: "POST",
      body: JSON.stringify({ sandboxId, packages, dev }),
    });
  }

  async applyTheme(
    sandboxId: string,
    theme: string
  ): Promise<{
    theme: string;
    output: string;
    cssContent: string;
  }> {
    return await this.request("/theme/apply", {
      method: "POST",
      body: JSON.stringify({ sandboxId, theme }),
    });
  }
}

// Export a singleton instance
export const daytonaAPI = new DaytonaAPIClient();

// Export the class for testing or custom instances
export default DaytonaAPIClient;
