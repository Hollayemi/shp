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
export { isConvexAPIError } from "./types.js";
// Management API
export { ConvexManagementAPI, ConvexManagementAPIError, ConvexDeploymentAPI, createConvexClient, } from "./management-api.js";
// Deploy Key Manager
export { encryptDeployKey, decryptDeployKey, isValidDeployKeyFormat, getDeployKeyType, getDeploymentNameFromKey, } from "./deploy-key-manager.js";
// Deployment Service
export { ShipperCloudDeploymentService, createDeploymentService, } from "./deployment-service.js";
export { 
// Better Auth generators
generateBetterAuthSecret, generateConvexConfigTs, generateAuthConfigTs, generateAuthTs, generateAuthTsPhase1, // For schema generation (no local schema import)
generateHttpTs, generateAuthClientTs, generateBasicSchemaTs, generateMainTsxWithAuth, generateConvexTsConfig, getRequiredPackages, getRequiredEnvVars, 
// Local Install generators (for admin plugin and other schema-changing plugins)
generateBetterAuthComponentConfig, generateBetterAuthStaticExport, generateBetterAuthAdapter, generateBetterAuthSchema, // Manual schema with admin plugin fields
// Legacy exports (deprecated - kept for backwards compatibility)
generateConvexAuthSecret, generateConvexAuthJWTKeys, generateBasicSchemaWithAuthTs, generateSchemaWithAuthTs, generateUsersTs, } from "./auth-templates.js";
//# sourceMappingURL=index.js.map