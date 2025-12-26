/**
 * Shipper Cloud Deployment Service
 *
 * High-level orchestration for provisioning and managing
 * Convex backends for Shipper projects.
 */
import { ConvexManagementAPI } from "./management-api.js";
import type { ProvisionResult, DeployCodeOptions, DeployCodeResult } from "./types.js";
/**
 * Shipper Cloud Deployment Service
 *
 * Handles the full lifecycle of Convex deployments for Shipper projects:
 * - Provisioning new backends
 * - Deploying code
 * - Managing deployment state
 */
export declare class ShipperCloudDeploymentService {
    private client;
    constructor(client?: ConvexManagementAPI);
    /**
     * Provision a new Shipper Cloud backend for a project
     *
     * This creates:
     * 1. A new Convex project
     * 2. A deploy key for CLI operations
     *
     * The deployment information should be stored in your database
     * using the returned data.
     *
     * @param shipperProjectId - The Shipper project ID
     * @param projectName - Name for the Convex project
     * @returns Provisioning result with deployment info
     *
     * @example
     * ```typescript
     * const service = new ShipperCloudDeploymentService();
     * const result = await service.provisionBackend("proj_123", "my-app");
     *
     * if (result.success) {
     *   // Store result.deployment in database
     *   // Set VITE_CONVEX_URL to result.deploymentUrl in sandbox
     * }
     * ```
     */
    provisionBackend(shipperProjectId: string, projectName: string): Promise<ProvisionResult>;
    /**
     * Deploy code to a Convex deployment
     *
     * This executes `npx convex deploy` with the provided deploy key.
     * The working directory should contain a `convex/` folder with
     * schema and function definitions.
     *
     * @param options - Deploy options including key and working directory
     * @returns Deployment result
     *
     * @example
     * ```typescript
     * const result = await service.deployCode({
     *   deployKey: decryptDeployKey(encryptedKey),
     *   cwd: "/path/to/project",
     *   timeout: 120000, // 2 minutes
     * });
     * ```
     */
    deployCode(options: DeployCodeOptions): Promise<DeployCodeResult>;
    /**
     * Get the decrypted deploy key for a deployment
     *
     * Use this when you need to perform CLI operations.
     *
     * @param encryptedKey - The encrypted deploy key from storage
     * @returns The plain text deploy key
     */
    getDeployKey(encryptedKey: string): string;
    /**
     * Delete a Convex project and all its data
     *
     * WARNING: This is destructive and cannot be undone.
     *
     * @param convexProjectId - The Convex project ID to delete
     */
    deleteDeployment(convexProjectId: string): Promise<void>;
    /**
     * List all Convex projects in the team
     *
     * Useful for admin dashboards and debugging.
     */
    listAllDeployments(): Promise<import("./types.js").ConvexProjectListItem[]>;
}
/**
 * Create a deployment service from environment variables
 */
export declare function createDeploymentService(): ShipperCloudDeploymentService;
//# sourceMappingURL=deployment-service.d.ts.map