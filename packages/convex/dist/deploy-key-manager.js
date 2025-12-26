/**
 * Deploy Key Manager
 *
 * Handles encryption and decryption of Convex deploy keys for secure storage.
 * Uses AES-256-GCM for encryption with a random IV per encryption.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
/**
 * Get the encryption secret from environment
 */
function getEncryptionSecret() {
    const secret = process.env.CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET;
    if (!secret) {
        throw new Error("CONVEX_DEPLOY_KEY_ENCRYPTION_SECRET environment variable is required");
    }
    return secret;
}
/**
 * Derive an encryption key from the secret using scrypt
 */
function deriveKey(secret, salt) {
    return scryptSync(secret, salt, KEY_LENGTH);
}
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
export function encryptDeployKey(deployKey) {
    const secret = getEncryptionSecret();
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    // Derive key from secret
    const key = deriveKey(secret, salt);
    // Encrypt
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(deployKey, "utf8"),
        cipher.final(),
    ]);
    // Get auth tag
    const authTag = cipher.getAuthTag();
    // Combine all parts: salt:iv:authTag:ciphertext (all base64)
    return [
        salt.toString("base64"),
        iv.toString("base64"),
        authTag.toString("base64"),
        encrypted.toString("base64"),
    ].join(":");
}
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
export function decryptDeployKey(encryptedKey) {
    const secret = getEncryptionSecret();
    // Parse the encrypted parts
    const parts = encryptedKey.split(":");
    if (parts.length !== 4) {
        throw new Error("Invalid encrypted key format");
    }
    const [saltB64, ivB64, authTagB64, ciphertextB64] = parts;
    const salt = Buffer.from(saltB64, "base64");
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    // Derive key from secret
    const key = deriveKey(secret, salt);
    // Decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
}
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
export function isValidDeployKeyFormat(deployKey) {
    // Basic format check: should have at least one colon and one pipe
    const pipeIndex = deployKey.indexOf("|");
    if (pipeIndex === -1) {
        return false;
    }
    const prefix = deployKey.slice(0, pipeIndex);
    const token = deployKey.slice(pipeIndex + 1);
    // Prefix should have at least type:name
    if (!prefix.includes(":")) {
        return false;
    }
    // Token should be a non-empty base64-ish string
    if (!token || token.length < 10) {
        return false;
    }
    // Check prefix type
    const prefixType = prefix.split(":")[0];
    const validTypes = ["dev", "prod", "preview", "project"];
    if (!validTypes.includes(prefixType)) {
        return false;
    }
    return true;
}
/**
 * Extract the deployment type from a deploy key
 *
 * @param deployKey - The deploy key
 * @returns The deployment type (dev, prod, preview, project)
 */
export function getDeployKeyType(deployKey) {
    const pipeIndex = deployKey.indexOf("|");
    if (pipeIndex === -1) {
        return null;
    }
    const prefix = deployKey.slice(0, pipeIndex);
    const type = prefix.split(":")[0];
    if (["dev", "prod", "preview", "project"].includes(type)) {
        return type;
    }
    return null;
}
/**
 * Extract the deployment name from a deploy key
 *
 * @param deployKey - The deploy key
 * @returns The deployment name (e.g., "happy-animal-123")
 */
export function getDeploymentNameFromKey(deployKey) {
    const pipeIndex = deployKey.indexOf("|");
    if (pipeIndex === -1) {
        return null;
    }
    const prefix = deployKey.slice(0, pipeIndex);
    const parts = prefix.split(":");
    // For dev/prod: type:deployment-name
    if (parts.length === 2) {
        return parts[1];
    }
    // For preview: type:team-slug:project-slug
    if (parts.length === 3) {
        return `${parts[1]}:${parts[2]}`;
    }
    return null;
}
//# sourceMappingURL=deploy-key-manager.js.map