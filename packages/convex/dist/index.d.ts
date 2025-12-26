/**
 * @shipper/convex
 *
 * Convex Management API client and deployment service for Shipper Cloud.
 *
 * @example
 * ```typescript
 * import {
 *   createDeploymentService,
 *   ShipperCloudDeploymentService,
 * } from "@shipper/convex";
 *
 * // Create service from environment variables
 * const service = createDeploymentService();
 *
 * // Provision a new backend
 * const result = await service.provisionBackend("proj_123", "my-app");
 *
 * if (result.success) {
 *   console.log("Deployment URL:", result.deploymentUrl);
 *   // Store result.deployment in your database
 * }
 * ```
 */
export type { ConvexProject, ConvexDeployKey, ConvexDeploymentType, ConvexClientConfig, ConvexProjectListItem, CreateProjectRequest, CreateProjectResponse, CreateDeployKeyRequest, CreateDeployKeyResponse, ShipperCloudDeployment, ProvisionResult, DeployCodeOptions, DeployCodeResult, ConvexAPIError, LogStreamIntegrationType, WebhookLogStreamConfig, WebhookLogStreamResult, } from "./types.js";
export { isConvexAPIError } from "./types.js";
export { ConvexManagementAPI, ConvexManagementAPIError, ConvexDeploymentAPI, createConvexClient, } from "./management-api.js";
export { encryptDeployKey, decryptDeployKey, isValidDeployKeyFormat, getDeployKeyType, getDeploymentNameFromKey, } from "./deploy-key-manager.js";
export { ShipperCloudDeploymentService, createDeploymentService, } from "./deployment-service.js";
export type { ConvexAuthConfig, ConvexAuthJWTKeys } from "./auth-templates.js";
export { generateBetterAuthSecret, generateConvexConfigTs, generateAuthConfigTs, generateAuthTs, generateAuthTsPhase1, // For schema generation (no local schema import)
generateHttpTs, generateAuthClientTs, generateBasicSchemaTs, generateMainTsxWithAuth, generateConvexTsConfig, getRequiredPackages, getRequiredEnvVars, generateBetterAuthComponentConfig, generateBetterAuthStaticExport, generateBetterAuthAdapter, generateBetterAuthSchema, // Manual schema with admin plugin fields
generateConvexAuthSecret, generateConvexAuthJWTKeys, generateBasicSchemaWithAuthTs, generateSchemaWithAuthTs, generateUsersTs, } from "./auth-templates.js";
//# sourceMappingURL=index.d.ts.map