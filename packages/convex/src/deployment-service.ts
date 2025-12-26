/**
 * Shipper Cloud Deployment Service
 *
 * High-level orchestration for provisioning and managing
 * Convex backends for Shipper projects.
 */

import { ConvexManagementAPI, createConvexClient } from "./management-api.js";
import { encryptDeployKey, decryptDeployKey } from "./deploy-key-manager.js";
import type {
  ProvisionResult,
  DeployCodeOptions,
  DeployCodeResult,
  ShipperCloudDeployment,
} from "./types.js";

/**
 * Shipper Cloud Deployment Service
 *
 * Handles the full lifecycle of Convex deployments for Shipper projects:
 * - Provisioning new backends
 * - Deploying code
 * - Managing deployment state
 */
export class ShipperCloudDeploymentService {
  private client: ConvexManagementAPI;

  constructor(client?: ConvexManagementAPI) {
    this.client = client ?? createConvexClient();
  }

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
  async provisionBackend(
    shipperProjectId: string,
    projectName: string
  ): Promise<ProvisionResult> {
    try {
      // Step 1: Create Convex project with PRODUCTION deployment
      // We use "prod" because `npx convex deploy` deploys to the production deployment
      // and requires a production deploy key
      console.log(
        `[ShipperCloud] Creating Convex project: ${projectName} for Shipper project: ${shipperProjectId}`
      );

      const project = await this.client.createProject(projectName, "prod");

      console.log(
        `[ShipperCloud] Created project: ${project.deploymentName} at ${project.deploymentUrl}`
      );

      // Step 2: Create deploy key
      console.log(
        `[ShipperCloud] Creating deploy key for deployment: ${project.deploymentName}`
      );

      const keyName = `shipper-${shipperProjectId}-${Date.now()}`;
      const deployKey = await this.client.createDeployKey(
        project.deploymentName,
        keyName
      );

      console.log(`[ShipperCloud] Created deploy key: ${keyName}`);

      // Step 3: Encrypt deploy key for storage
      const encryptedKey = encryptDeployKey(deployKey.deployKey);

      // Build deployment record
      const deployment: ShipperCloudDeployment = {
        shipperProjectId,
        convexProjectId: project.projectId,
        convexDeploymentName: project.deploymentName,
        convexDeploymentUrl: project.deploymentUrl,
        deployKeyEncrypted: encryptedKey,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log(
        `[ShipperCloud] Backend provisioned successfully for ${shipperProjectId}`
      );

      return {
        success: true,
        deploymentUrl: project.deploymentUrl,
        deploymentName: project.deploymentName,
        deployment,
      };
    } catch (error) {
      console.error(
        `[ShipperCloud] Failed to provision backend for ${shipperProjectId}:`,
        error
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

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
  async deployCode(options: DeployCodeOptions): Promise<DeployCodeResult> {
    const { deployKey, cwd, timeout = 120000 } = options;

    try {
      console.log(`[ShipperCloud] Deploying code from ${cwd}`);

      // Use dynamic import for child_process to work in both Node and edge
      const { spawn } = await import("child_process");

      return new Promise((resolve) => {
        const env = {
          ...process.env,
          CONVEX_DEPLOY_KEY: deployKey,
        };

        const child = spawn("npx", ["convex", "deploy", "--yes"], {
          cwd,
          env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        });

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr?.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        const timeoutId = setTimeout(() => {
          child.kill("SIGTERM");
          resolve({
            success: false,
            error: `Deployment timed out after ${timeout}ms`,
            stdout,
            stderr,
          });
        }, timeout);

        child.on("close", (code) => {
          clearTimeout(timeoutId);

          if (code === 0) {
            console.log(`[ShipperCloud] Deployment successful`);

            // Try to extract deployment URL from stdout
            const urlMatch = stdout.match(
              /https:\/\/[a-z-]+\d*\.convex\.cloud/
            );

            resolve({
              success: true,
              deploymentUrl: urlMatch?.[0],
              stdout,
              stderr,
            });
          } else {
            console.error(`[ShipperCloud] Deployment failed with code ${code}`);
            resolve({
              success: false,
              error: `Deployment failed with exit code ${code}`,
              stdout,
              stderr,
            });
          }
        });

        child.on("error", (error) => {
          clearTimeout(timeoutId);
          console.error(`[ShipperCloud] Deployment process error:`, error);
          resolve({
            success: false,
            error: error.message,
            stdout,
            stderr,
          });
        });
      });
    } catch (error) {
      console.error(`[ShipperCloud] Failed to deploy code:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get the decrypted deploy key for a deployment
   *
   * Use this when you need to perform CLI operations.
   *
   * @param encryptedKey - The encrypted deploy key from storage
   * @returns The plain text deploy key
   */
  getDeployKey(encryptedKey: string): string {
    return decryptDeployKey(encryptedKey);
  }

  /**
   * Delete a Convex project and all its data
   *
   * WARNING: This is destructive and cannot be undone.
   *
   * @param convexProjectId - The Convex project ID to delete
   */
  async deleteDeployment(convexProjectId: string): Promise<void> {
    console.log(`[ShipperCloud] Deleting Convex project: ${convexProjectId}`);
    await this.client.deleteProject(convexProjectId);
    console.log(`[ShipperCloud] Deleted Convex project: ${convexProjectId}`);
  }

  /**
   * List all Convex projects in the team
   *
   * Useful for admin dashboards and debugging.
   */
  async listAllDeployments() {
    return this.client.listProjects();
  }
}

/**
 * Create a deployment service from environment variables
 */
export function createDeploymentService(): ShipperCloudDeploymentService {
  return new ShipperCloudDeploymentService();
}
