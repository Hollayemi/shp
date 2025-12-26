/**
 * Encryption utilities for connector credentials
 *
 * Reuses the existing encryption service pattern from the codebase.
 * All OAuth tokens and API keys are encrypted at rest.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SECRETS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY environment variable is required for connector encryption",
    );
  }

  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY must be 64 hex characters (32 bytes)",
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Encrypt a string value
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt credentials object (JSON)
 */
export function encryptCredentials(
  credentials: Record<string, string>,
): string {
  return encrypt(JSON.stringify(credentials));
}

/**
 * Decrypt credentials object (JSON)
 */
export function decryptCredentials(encrypted: string): Record<string, string> {
  const decrypted = decrypt(encrypted);
  return JSON.parse(decrypted);
}
