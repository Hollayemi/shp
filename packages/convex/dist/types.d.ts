/**
 * Convex Management API Types
 *
 * These types define the shape of data used when interacting with
 * the Convex Management API for Shipper Cloud deployments.
 */
/**
 * Result from creating a new Convex project
 */
export interface ConvexProject {
    /** Convex project ID */
    projectId: string;
    /** Unique deployment name (e.g., "happy-animal-123") */
    deploymentName: string;
    /** Full deployment URL (e.g., "https://happy-animal-123.convex.cloud") */
    deploymentUrl: string;
}
/**
 * Result from creating a deploy key
 */
export interface ConvexDeployKey {
    /** Deploy key for CLI usage (e.g., "dev:happy-animal-123|eyJ...") */
    deployKey: string;
    /** Name given to this deploy key */
    name: string;
}
/**
 * Deployment type options when creating a project
 */
export type ConvexDeploymentType = "dev" | "prod";
/**
 * Configuration for the Convex Management API client
 */
export interface ConvexClientConfig {
    /** Team access token from Convex dashboard */
    teamAccessToken: string;
    /** Team ID from Convex dashboard */
    teamId: string;
    /** Optional base URL override (defaults to https://api.convex.dev/v1) */
    baseUrl?: string;
}
/**
 * Project listing response
 */
export interface ConvexProjectListItem {
    projectId: string;
    projectName: string;
    deployments: Array<{
        deploymentName: string;
        deploymentType: ConvexDeploymentType;
        deploymentUrl: string;
    }>;
}
/**
 * Request body for creating a project
 */
export interface CreateProjectRequest {
    projectName: string;
    deploymentType: ConvexDeploymentType;
}
/**
 * Response from creating a project
 */
export interface CreateProjectResponse {
    projectId: string;
    deploymentName: string;
    deploymentUrl: string;
}
/**
 * Request body for creating a deploy key
 */
export interface CreateDeployKeyRequest {
    name: string;
}
/**
 * Response from creating a deploy key
 */
export interface CreateDeployKeyResponse {
    deployKey: string;
}
/**
 * Shipper Cloud deployment record (stored in our database)
 */
export interface ShipperCloudDeployment {
    /** Our Shipper project ID */
    shipperProjectId: string;
    /** Convex project ID */
    convexProjectId: string;
    /** Unique Convex deployment name */
    convexDeploymentName: string;
    /** Full Convex deployment URL */
    convexDeploymentUrl: string;
    /** Encrypted deploy key for CLI operations */
    deployKeyEncrypted: string;
    /** Deployment status */
    status: "active" | "deleted" | "error";
    /** When the deployment was created */
    createdAt: Date;
    /** When the deployment was last updated */
    updatedAt: Date;
}
/**
 * Result from provisioning a full backend
 */
export interface ProvisionResult {
    /** Whether provisioning succeeded */
    success: boolean;
    /** The Convex deployment URL to use in the app */
    deploymentUrl?: string;
    /** The deployment name */
    deploymentName?: string;
    /** Error message if failed */
    error?: string;
    /** The stored deployment record */
    deployment?: ShipperCloudDeployment;
}
/**
 * Options for deploying code to Convex
 */
export interface DeployCodeOptions {
    /** Deploy key for authentication */
    deployKey: string;
    /** Working directory containing convex/ folder */
    cwd: string;
    /** Optional timeout in milliseconds */
    timeout?: number;
}
/**
 * Result from deploying code
 */
export interface DeployCodeResult {
    /** Whether deployment succeeded */
    success: boolean;
    /** Deployment URL */
    deploymentUrl?: string;
    /** Error message if failed */
    error?: string;
    /** Standard output from CLI */
    stdout?: string;
    /** Standard error from CLI */
    stderr?: string;
}
/**
 * Error from Convex Management API
 */
export interface ConvexAPIError {
    /** Error code from Convex */
    code: string;
    /** Error message */
    message: string;
    /** HTTP status code */
    status: number;
}
/**
 * Type guard for ConvexAPIError
 */
export declare function isConvexAPIError(error: unknown): error is ConvexAPIError;
/**
 * Log stream integration types
 */
export type LogStreamIntegrationType = "webhook" | "datadog" | "axiom" | "sentry";
/**
 * Webhook log stream configuration
 */
export interface WebhookLogStreamConfig {
    /** URL to send log events to */
    url: string;
    /** Format for the log events */
    format: "json" | "jsonl";
}
/**
 * Result from creating a webhook log stream
 */
export interface WebhookLogStreamResult {
    /** Whether creation succeeded */
    success: boolean;
    /** The webhook secret for HMAC verification */
    webhookSecret?: string;
    /** Error message if failed */
    error?: string;
    /** Raw response from Convex API for debugging */
    rawResponse?: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map