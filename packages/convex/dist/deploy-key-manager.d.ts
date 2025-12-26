/**
 * Deploy Key Manager
 *
 * Handles encryption and decryption of Convex deploy keys for secure storage.
 * Uses AES-256-GCM for encryption with a random IV per encryption.
 */
/**
 * Encrypt a deploy key for secure storage
 *
 * @param deployKey - The plain text deploy key to encrypt
 * @returns Base64 encoded encrypted string (salt:iv:authTag:ciphertext)
 *
 * @example
 * ```typescript
 * const encrypted = encryptDeployKey("dev:happy-animal-123|eyJ...");
 * // Store encrypted string in database
 * ```
 */
export declare function encryptDeployKey(deployKey: string): string;
/**
 * Decrypt a stored deploy key
 *
 * @param encryptedKey - The encrypted string from storage
 * @returns The original deploy key
 *
 * @example
 * ```typescript
 * const deployKey = decryptDeployKey(storedEncryptedKey);
 * // Use deployKey with Convex CLI
 * ```
 */
export declare function decryptDeployKey(encryptedKey: string): string;
/**
 * Validate that a deploy key is in the expected format
 *
 * Deploy keys follow the pattern: type:name|token
 * - dev:happy-animal-123|eyJ...
 * - prod:qualified-jaguar-123|eyJ...
 * - preview:team-slug:project-slug|eyJ...
 *
 * @param deployKey - The deploy key to validate
 * @returns True if valid format
 */
export declare function isValidDeployKeyFormat(deployKey: string): boolean;
/**
 * Extract the deployment type from a deploy key
 *
 * @param deployKey - The deploy key
 * @returns The deployment type (dev, prod, preview, project)
 */
export declare function getDeployKeyType(deployKey: string): "dev" | "prod" | "preview" | "project" | null;
/**
 * Extract the deployment name from a deploy key
 *
 * @param deployKey - The deploy key
 * @returns The deployment name (e.g., "happy-animal-123")
 */
export declare function getDeploymentNameFromKey(deployKey: string): string | null;
//# sourceMappingURL=deploy-key-manager.d.ts.map