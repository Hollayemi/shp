/**
 * Convex Management API Client
 *
 * Provides methods to interact with the Convex Management API for:
 * - Creating projects and deployments
 * - Managing deploy keys
 * - Listing and deleting projects
 *
 * @see https://docs.convex.dev/management-api
 */

import type {
  ConvexClientConfig,
  ConvexProject,
  ConvexDeployKey,
  ConvexDeploymentType,
  ConvexProjectListItem,
  CreateProjectResponse,
  CreateDeployKeyResponse,
  ConvexAPIError,
  LogStreamIntegrationType,
  WebhookLogStreamConfig,
  WebhookLogStreamResult,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.convex.dev/v1";

/**
 * Convex Management API client for Shipper Cloud
 */
export class ConvexManagementAPI {
  private readonly teamAccessToken: string;
  private readonly teamId: string;
  private readonly baseUrl: string;

  constructor(config: ConvexClientConfig) {
    this.teamAccessToken = config.teamAccessToken;
    this.teamId = config.teamId;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  /**
   * Create a new Convex project with a deployment
   *
   * @param projectName - Name for the new project (will be slugified by Convex)
   * @param deploymentType - Type of deployment ("dev" or "prod")
   * @returns Project info including deployment name and URL
   *
   * @example
   * ```typescript
   * const project = await client.createProject("my-app", "dev");
   * console.log(project.deploymentUrl);
   * // => "https://happy-animal-123.convex.cloud"
   * ```
   */
  async createProject(
    projectName: string,
    deploymentType: ConvexDeploymentType = "dev"
  ): Promise<ConvexProject> {
    const response = await this.request<CreateProjectResponse>(
      `teams/${this.teamId}/create_project`,
      {
        method: "POST",
        body: JSON.stringify({
          projectName,
          deploymentType,
        }),
      }
    );

    return {
      projectId: response.projectId,
      deploymentName: response.deploymentName,
      deploymentUrl: response.deploymentUrl,
    };
  }

  /**
   * Create a deploy key for a deployment
   *
   * Deploy keys are used to authenticate CLI operations like `npx convex deploy`.
   *
   * @param deploymentName - The deployment name (e.g., "happy-animal-123")
   * @param keyName - A descriptive name for this key
   * @returns The deploy key
   *
   * @example
   * ```typescript
   * const key = await client.createDeployKey("happy-animal-123", "CI/CD");
   * // Use key.deployKey with CONVEX_DEPLOY_KEY env var
   * ```
   */
  async createDeployKey(
    deploymentName: string,
    keyName: string
  ): Promise<ConvexDeployKey> {
    const response = await this.request<CreateDeployKeyResponse>(
      `deployments/${deploymentName}/create_deploy_key`,
      {
        method: "POST",
        body: JSON.stringify({
          name: keyName,
        }),
      }
    );

    return {
      deployKey: response.deployKey,
      name: keyName,
    };
  }

  /**
   * List all projects in the team
   *
   * @returns Array of projects with their deployments
   */
  async listProjects(): Promise<ConvexProjectListItem[]> {
    const response = await this.request<{ projects: ConvexProjectListItem[] }>(
      `teams/${this.teamId}/list_projects`,
      {
        method: "GET",
      }
    );

    return response.projects;
  }

  /**
   * Delete a project and all its deployments
   *
   * WARNING: This is destructive and cannot be undone.
   *
   * @param projectId - The Convex project ID to delete
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.request<void>(`projects/${projectId}/delete`, {
      method: "POST",
    });
  }

  /**
   * Get token details (useful for debugging/validation)
   *
   * @returns Token metadata including team and project info
   */
  async getTokenDetails(): Promise<{
    teamId?: string;
    projectId?: string;
    deploymentName?: string;
  }> {
    return this.request(`token_details`, {
      method: "GET",
    });
  }

  /**
   * Make an authenticated request to the Convex Management API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.teamAccessToken}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      let errorData: ConvexAPIError;
      try {
        const body = (await response.json()) as {
          code?: string;
          message?: string;
        };
        errorData = {
          code: body.code || "UNKNOWN_ERROR",
          message: body.message || response.statusText,
          status: response.status,
        };
      } catch {
        errorData = {
          code: "UNKNOWN_ERROR",
          message: response.statusText,
          status: response.status,
        };
      }

      throw new ConvexManagementAPIError(errorData);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

/**
 * Custom error class for Convex Management API errors
 */
export class ConvexManagementAPIError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(error: ConvexAPIError) {
    super(error.message);
    this.name = "ConvexManagementAPIError";
    this.code = error.code;
    this.status = error.status;
  }
}

/**
 * Create a Convex Management API client from environment variables
 *
 * Requires:
 * - CONVEX_TEAM_ACCESS_TOKEN
 * - CONVEX_TEAM_ID
 *
 * @returns Configured client instance
 * @throws Error if required environment variables are missing
 */
export function createConvexClient(): ConvexManagementAPI {
  const teamAccessToken = process.env.CONVEX_TEAM_ACCESS_TOKEN;
  const teamId = process.env.CONVEX_TEAM_ID;

  if (!teamAccessToken) {
    throw new Error(
      "CONVEX_TEAM_ACCESS_TOKEN environment variable is required"
    );
  }

  if (!teamId) {
    throw new Error("CONVEX_TEAM_ID environment variable is required");
  }

  return new ConvexManagementAPI({
    teamAccessToken,
    teamId,
  });
}

/**
 * Convex Deployment API client for deployment-level operations
 *
 * This client is used for operations that target a specific deployment,
 * such as configuring log streams. It uses the deploy key for authentication.
 */
export class ConvexDeploymentAPI {
  private readonly deploymentUrl: string;
  private readonly deployKey: string;

  constructor(deploymentUrl: string, deployKey: string) {
    // Ensure URL doesn't have trailing slash
    this.deploymentUrl = deploymentUrl.replace(/\/$/, "");
    this.deployKey = deployKey;
  }

  /**
   * Create a webhook log stream integration
   *
   * This configures the deployment to send log events to the specified webhook URL.
   * The webhook will receive function_execution and current_storage_usage events.
   *
   * @param config - Webhook configuration (url and format)
   * @returns Result including the webhook secret for HMAC verification
   *
   * @example
   * ```typescript
   * const api = new ConvexDeploymentAPI(deploymentUrl, deployKey);
   * const result = await api.createWebhookLogStream({
   *   url: "https://billing.shipper.app/webhook/convex",
   *   format: "json"
   * });
   * // Store result.webhookSecret for signature verification
   * ```
   */
  async createWebhookLogStream(
    config: WebhookLogStreamConfig
  ): Promise<WebhookLogStreamResult> {
    try {
      // Step 1: Create the webhook sink
      const response = await fetch(`${this.deploymentUrl}/api/logs/webhook_sink`, {
        method: "POST",
        headers: {
          Authorization: `Convex ${this.deployKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
        return {
          success: false,
          error: error.message || `HTTP ${response.status}`,
        };
      }

      // Step 2: Retrieve the webhook secret from configured sinks
      // This is better than regenerating because it doesn't invalidate existing secrets
      const sinks = await this.listConfiguredSinks();

      if (sinks && Array.isArray(sinks.value)) {
        const webhookSink = (sinks.value as Array<{ config?: { type?: string; hmacSecret?: string } }>)
          .find(sink => sink.config?.type === "webhook");

        if (webhookSink?.config?.hmacSecret) {
          return {
            success: true,
            webhookSecret: webhookSink.config.hmacSecret,
            rawResponse: sinks,
          };
        }
      }

      // Fallback: regenerate if we couldn't retrieve from sinks
      const secretResponse = await fetch(
        `${this.deploymentUrl}/api/logs/regenerate_webhook_secret`,
        {
          method: "POST",
          headers: {
            Authorization: `Convex ${this.deployKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!secretResponse.ok) {
        const error = await secretResponse.json().catch(() => ({ message: secretResponse.statusText })) as { message?: string };
        return {
          success: true, // Webhook was created, but secret retrieval failed
          error: `Webhook created but failed to get secret: ${error.message || `HTTP ${secretResponse.status}`}`,
        };
      }

      const secretData = await secretResponse.json().catch(() => ({})) as Record<string, unknown>;

      const webhookSecret =
        (secretData.webhookSecret as string) ||
        (secretData.secret as string) ||
        (secretData.hmacSecret as string) ||
        (secretData.signingSecret as string);

      return {
        success: true,
        webhookSecret,
        rawResponse: secretData,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a log stream integration
   *
   * @param integrationType - Type of integration to delete
   */
  async deleteLogStream(integrationType: LogStreamIntegrationType): Promise<boolean> {
    try {
      const response = await fetch(`${this.deploymentUrl}/api/logs/delete_sink`, {
        method: "DELETE",
        headers: {
          Authorization: `Convex ${this.deployKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sinkType: integrationType }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get the webhook secret from an existing configured sink
   *
   * This retrieves the current webhook secret without regenerating it.
   * Useful for syncing the secret to your database if it was lost.
   *
   * @returns The webhook secret, or null if no webhook sink is configured
   */
  async getWebhookSecret(): Promise<string | null> {
    const sinks = await this.listConfiguredSinks();

    if (sinks && Array.isArray(sinks.value)) {
      const webhookSink = (sinks.value as Array<{ config?: { type?: string; hmacSecret?: string } }>)
        .find(sink => sink.config?.type === "webhook");

      return webhookSink?.config?.hmacSecret ?? null;
    }

    return null;
  }

  /**
   * Regenerate the webhook secret for HMAC verification
   *
   * Use this if the secret is compromised or needs rotation.
   *
   * @returns The new webhook secret, or null if failed
   */
  async regenerateWebhookSecret(): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.deploymentUrl}/api/logs/regenerate_webhook_secret`,
        {
          method: "POST",
          headers: {
            Authorization: `Convex ${this.deployKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json().catch(() => ({})) as { webhookSecret?: string; secret?: string };
      return data.webhookSecret || data.secret || null;
    } catch {
      return null;
    }
  }

  /**
   * List configured log stream sinks
   *
   * Uses the internal Convex query endpoint to retrieve configured sinks,
   * which may include webhook configuration details.
   *
   * @returns The configured sinks data, or null if failed
   */
  async listConfiguredSinks(): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.deploymentUrl}/api/query`, {
        method: "POST",
        headers: {
          Authorization: `Convex ${this.deployKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: "_system/frontend/listConfiguredSinks",
          args: {},
          format: "json",
        }),
      });

      if (!response.ok) {
        console.error(`listConfiguredSinks failed: ${response.status} ${response.statusText}`);
        const errorText = await response.text().catch(() => "");
        console.error("Error body:", errorText);
        return null;
      }

      const data = await response.json();
      return data as Record<string, unknown>;
    } catch (error) {
      console.error("listConfiguredSinks error:", error);
      return null;
    }
  }

  /**
   * Set environment variables for the deployment
   *
   * This uses the Convex API directly to set environment variables,
   * which properly handles multiline values (unlike the CLI).
   *
   * @param variables - Object mapping variable names to values
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * const api = new ConvexDeploymentAPI(deploymentUrl, deployKey);
   * const result = await api.setEnvironmentVariables({
   *   JWT_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
   *   JWKS: '{"keys":[...]}',
   * });
   * ```
   */
  async setEnvironmentVariables(
    variables: Record<string, string>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert variables object to the format expected by the API
      const changes = Object.entries(variables).map(([name, value]) => ({
        name,
        value,
      }));

      const response = await fetch(
        `${this.deploymentUrl}/api/v1/update_environment_variables`,
        {
          method: "POST",
          headers: {
            Authorization: `Convex ${this.deployKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ changes }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string };
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        return {
          success: false,
          error: errorMessage,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
