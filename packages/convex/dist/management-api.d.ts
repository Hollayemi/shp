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
import type { ConvexClientConfig, ConvexProject, ConvexDeployKey, ConvexDeploymentType, ConvexProjectListItem, ConvexAPIError, LogStreamIntegrationType, WebhookLogStreamConfig, WebhookLogStreamResult } from "./types.js";
/**
 * Convex Management API client for Shipper Cloud
 */
export declare class ConvexManagementAPI {
    private readonly teamAccessToken;
    private readonly teamId;
    private readonly baseUrl;
    constructor(config: ConvexClientConfig);
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
    createProject(projectName: string, deploymentType?: ConvexDeploymentType): Promise<ConvexProject>;
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
    createDeployKey(deploymentName: string, keyName: string): Promise<ConvexDeployKey>;
    /**
     * List all projects in the team
     *
     * @returns Array of projects with their deployments
     */
    listProjects(): Promise<ConvexProjectListItem[]>;
    /**
     * Delete a project and all its deployments
     *
     * WARNING: This is destructive and cannot be undone.
     *
     * @param projectId - The Convex project ID to delete
     */
    deleteProject(projectId: string): Promise<void>;
    /**
     * Get token details (useful for debugging/validation)
     *
     * @returns Token metadata including team and project info
     */
    getTokenDetails(): Promise<{
        teamId?: string;
        projectId?: string;
        deploymentName?: string;
    }>;
    /**
     * Make an authenticated request to the Convex Management API
     */
    private request;
}
/**
 * Custom error class for Convex Management API errors
 */
export declare class ConvexManagementAPIError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(error: ConvexAPIError);
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
export declare function createConvexClient(): ConvexManagementAPI;
/**
 * Convex Deployment API client for deployment-level operations
 *
 * This client is used for operations that target a specific deployment,
 * such as configuring log streams. It uses the deploy key for authentication.
 */
export declare class ConvexDeploymentAPI {
    private readonly deploymentUrl;
    private readonly deployKey;
    constructor(deploymentUrl: string, deployKey: string);
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
    createWebhookLogStream(config: WebhookLogStreamConfig): Promise<WebhookLogStreamResult>;
    /**
     * Delete a log stream integration
     *
     * @param integrationType - Type of integration to delete
     */
    deleteLogStream(integrationType: LogStreamIntegrationType): Promise<boolean>;
    /**
     * Get the webhook secret from an existing configured sink
     *
     * This retrieves the current webhook secret without regenerating it.
     * Useful for syncing the secret to your database if it was lost.
     *
     * @returns The webhook secret, or null if no webhook sink is configured
     */
    getWebhookSecret(): Promise<string | null>;
    /**
     * Regenerate the webhook secret for HMAC verification
     *
     * Use this if the secret is compromised or needs rotation.
     *
     * @returns The new webhook secret, or null if failed
     */
    regenerateWebhookSecret(): Promise<string | null>;
    /**
     * List configured log stream sinks
     *
     * Uses the internal Convex query endpoint to retrieve configured sinks,
     * which may include webhook configuration details.
     *
     * @returns The configured sinks data, or null if failed
     */
    listConfiguredSinks(): Promise<Record<string, unknown> | null>;
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
    setEnvironmentVariables(variables: Record<string, string>): Promise<{
        success: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=management-api.d.ts.map