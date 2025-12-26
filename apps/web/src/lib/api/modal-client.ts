/**
 * Modal API Client
 *
 * Client for communicating with the Modal API server.
 * This provides a clean interface for Modal sandbox operations.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SHIPPER_API_KEY = process.env.SHIPPER_API_KEY;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ModalSandboxInfo {
  sandboxId: string;
  sandboxUrl: string; // Transformed shipper.now proxy URL
  originalSandboxUrl?: string; // Original Modal URL (direct)
  sandboxExpiresAt?: Date | null;
}

export interface ModalExecutionResult {
  result?: string;
  output?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export interface CommandOptions {
  timeoutMs?: number;
}

class ModalAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    console.log(`[ModalClient] Initialized with baseUrl: ${this.baseUrl}`);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs: number = 15000, // 15 second default timeout (Modal can be slow)
  ): Promise<T> {
    const url = `${this.baseUrl}/api/v1/modal${endpoint}`;
    const method = options.method || "GET";

    console.log(`[ModalClient] ${method} ${url} - Starting...`);

    if (!SHIPPER_API_KEY) {
      throw new Error("SHIPPER_API_KEY environment variable is not set");
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": SHIPPER_API_KEY,
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      console.log(
        `[ModalClient] ${method} ${url} - Response status: ${response.status}`,
      );

      const data: ApiResponse<T> = await response.json();

      if (!data.success) {
        console.error(
          `[ModalClient] ${method} ${url} - API Error:`,
          data.error,
        );
        const isNotFound =
          response.status === 404 ||
          (data.error && data.error.toLowerCase().includes("sandbox not found"));
        if (isNotFound) {
          // Normalize 404 Sandbox not found so callers can handle gracefully
          throw new Error("404: Sandbox not found");
        }
        throw new Error(data.error || "API request failed");
      }

      console.log(`[ModalClient] ${method} ${url} - Success`);
      return data.data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Provide clearer error messages for common connection issues
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.warn(
            `[ModalClient] ${method} ${url} - Timeout after ${timeoutMs}ms`,
          );
          throw new Error(
            `Modal API timeout after ${timeoutMs}ms - sandbox service may be unavailable`,
          );
        }
        if (
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("fetch failed")
        ) {
          console.warn(
            `[ModalClient] ${method} ${url} - Connection refused (sandbox service not running)`,
          );
          throw new Error(
            "Modal API unavailable - sandbox service not running on localhost:4000",
          );
        }
        if (error.message.includes("ECONNRESET")) {
          console.warn(`[ModalClient] ${method} ${url} - Connection reset`);
          throw new Error(
            "Modal API connection reset - sandbox service may have crashed",
          );
        }
      }

      console.error(`[ModalClient] ${method} ${url} - Request failed:`, error);
      throw error;
    }
  }

  // Sandbox Management

  /**
   * Get sandbox status (read-only, does NOT trigger recovery)
   * Use this for admin dashboard status checks
   */
  async getSandboxStatus(projectId: string): Promise<{
    isActive: boolean;
    status: "running" | "unhealthy" | "not_found" | "terminated";
    sandboxId: string | null;
    sandboxUrl: string | null;
    sandboxExpiresAt: Date | null;
    healthReason?: string;
    missingFiles?: string[];
    error?: string;
  }> {
    try {
      return await this.request<{
        isActive: boolean;
        status: "running" | "unhealthy" | "not_found" | "terminated";
        sandboxId: string | null;
        sandboxUrl: string | null;
        sandboxExpiresAt: Date | null;
        healthReason?: string;
        missingFiles?: string[];
        error?: string;
      }>(`/sandbox/${projectId}/status`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const notFound = msg.includes("404") || msg.toLowerCase().includes("sandbox not found");
      if (notFound) {
        return {
          isActive: false,
          status: "not_found",
          sandboxId: null,
          sandboxUrl: null,
          sandboxExpiresAt: null,
          error: "Sandbox not found",
        };
      }
      // For other errors, surface as terminated to trigger cleanup but include message
      return {
        isActive: false,
        status: "terminated",
        sandboxId: null,
        sandboxUrl: null,
        sandboxExpiresAt: null,
        error: msg,
      };
    }
  }

  /**
   * Get sandbox info (WILL trigger automatic recovery if unhealthy)
   * Use this for normal app operations where you want auto-recovery
   */
  async getSandbox(projectId: string): Promise<ModalSandboxInfo | null> {
    try {
      return await this.request<ModalSandboxInfo>(`/sandbox/${projectId}`);
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
    templateName?: string,
    options?: { isImportedProject?: boolean; importedFrom?: string | null },
  ): Promise<ModalSandboxInfo> {
    // Sandbox creation involves provisioning, file restoration, and npm install
    // Imported projects need longer timeout for bun install + dev server startup
    const isImportedProject = options?.isImportedProject ?? false;
    const CREATE_TIMEOUT_MS = isImportedProject ? 300000 : 120000; // 5 minutes for imports, 2 minutes for templates
    return await this.request<ModalSandboxInfo>(
      "/sandbox",
      {
        method: "POST",
        body: JSON.stringify({
          projectId,
          fragmentId,
          templateName,
          isImportedProject,
          importedFrom: options?.importedFrom,
        }),
      },
      CREATE_TIMEOUT_MS,
    );
  }

  async deleteSandbox(sandboxId: string): Promise<void> {
    await this.request(`/sandbox/${sandboxId}`, {
      method: "DELETE",
    });
  }

  async startDevServer(
    sandboxId: string,
    projectId: string,
    port: number = 8080,
  ): Promise<string> {
    // Dev server startup can take time for npm install and Vite initialization
    const START_DEV_TIMEOUT_MS = 60000; // 1 minute
    const result = await this.request<{ devServerUrl: string }>(
      "/sandbox/start-dev-server",
      {
        method: "POST",
        body: JSON.stringify({ sandboxId, projectId, port }),
      },
      START_DEV_TIMEOUT_MS,
    );
    return result.devServerUrl;
  }

  // Fragment & File Operations

  async restoreV2Fragment(
    sandboxId: string,
    fragmentId: string,
    projectId: string,
  ): Promise<void> {
    // Fragment restoration can involve many file writes
    const RESTORE_TIMEOUT_MS = 60000; // 1 minute
    await this.request(
      "/fragment/restore",
      {
        method: "POST",
        body: JSON.stringify({ sandboxId, fragmentId, projectId }),
      },
      RESTORE_TIMEOUT_MS,
    );
  }

  async restoreFiles(
    sandboxId: string,
    files: Record<string, string>,
  ): Promise<void> {
    // File restoration can involve many file writes
    const RESTORE_TIMEOUT_MS = 60000; // 1 minute
    await this.request(
      "/files/restore",
      {
        method: "POST",
        body: JSON.stringify({ sandboxId, files }),
      },
      RESTORE_TIMEOUT_MS,
    );
  }

  // Command Execution

  async executeCommand(
    sandboxId: string,
    command: string,
    options?: CommandOptions,
  ): Promise<ModalExecutionResult> {
    // HTTP request timeout should be longer than command timeout to allow for network latency
    const commandTimeout = options?.timeoutMs || 30000; // Default 30s for commands
    const httpTimeout = commandTimeout + 10000; // Add 10s buffer for HTTP overhead
    return await this.request<ModalExecutionResult>(
      "/command/execute",
      {
        method: "POST",
        body: JSON.stringify({
          sandboxId,
          command,
          timeoutMs: options?.timeoutMs,
        }),
      },
      httpTimeout,
    );
  }

  // File Operations

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
    content: string,
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
    fileExtension: string,
  ): Promise<{ path: string; filename: string; url: string }> {
    return await this.request<{ path: string; filename: string; url: string }>(
      "/metadata/upload-image",
      {
        method: "POST",
        body: JSON.stringify({
          projectId,
          imageType,
          base64Data,
          fileExtension,
        }),
      },
    );
  }

  async getMetadataImage(
    projectId: string,
    imageType: "icon" | "shareImage",
  ): Promise<{ dataUrl: string; mimeType: string; filename: string }> {
    return await this.request<{
      dataUrl: string;
      mimeType: string;
      filename: string;
    }>(
      `/metadata/get-image?projectId=${encodeURIComponent(projectId)}&imageType=${encodeURIComponent(imageType)}`,
      {
        method: "GET",
      },
    );
  }

  async listFiles(
    sandboxId: string,
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

  async deploySandbox(
    sandboxId: string,
    projectId: string,
    appName?: string,
  ): Promise<{
    success: boolean;
    deploymentUrl?: string;
    error?: string;
    logs: string;
  }> {
    // Deployment operations can take 30-120+ seconds (build, zip, upload)
    const DEPLOY_TIMEOUT_MS = 180000; // 3 minutes
    return await this.request<{
      success: boolean;
      deploymentUrl?: string;
      error?: string;
      logs: string;
    }>(
      "/deploy",
      {
        method: "POST",
        body: JSON.stringify({ sandboxId, projectId, appName }),
      },
      DEPLOY_TIMEOUT_MS,
    );
  }

  async batchWriteFiles(
    sandboxId: string,
    files: Array<{ path: string; content: string }>,
  ): Promise<Array<{ path: string; success: boolean; error?: string }>> {
    // Batch writes can involve many files
    const BATCH_WRITE_TIMEOUT_MS = 60000; // 1 minute
    const result = await this.request<{
      results: Array<{ path: string; success: boolean; error?: string }>;
    }>(
      "/files/batch-write",
      {
        method: "POST",
        body: JSON.stringify({ sandboxId, files }),
      },
      BATCH_WRITE_TIMEOUT_MS,
    );
    return result.results;
  }
}

// Export a singleton instance
export const modalAPI = new ModalAPIClient();

// Export the class for testing or custom instances
export default ModalAPIClient;
