/**
 * Chat Token Encryption/Decryption
 *
 * Provides secure token generation for cross-origin chat authentication.
 * Tokens contain session information encrypted with AES-256-GCM.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Token payload structure
export interface ChatTokenPayload {
  sessionToken: string;
  userId: string;
  email: string;
  expiresAt: number; // Unix timestamp
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from secret
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  const crypto = require("crypto");
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, "sha256");
}

/**
 * Encrypt chat token payload
 */
export function encryptChatToken(
  payload: ChatTokenPayload,
  secret: string
): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const payloadJson = JSON.stringify(payload);

  let encrypted = cipher.update(payloadJson, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + encrypted
  const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, "hex")]);

  return combined.toString("base64url");
}

/**
 * Decrypt chat token
 */
export function decryptChatToken(
  encryptedToken: string,
  secret: string
): ChatTokenPayload | null {
  try {
    const combined = Buffer.from(encryptedToken, "base64url");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = deriveKey(secret, salt);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
    decrypted += decipher.final("utf8");

    const payload = JSON.parse(decrypted) as ChatTokenPayload;

    // Validate expiration
    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("[ChatToken] Decryption failed:", error);
    return null;
  }
}

/**
 * Create a chat token with 1 hour expiration
 */
export function createChatToken(
  sessionToken: string,
  userId: string,
  email: string,
  secret: string
): string {
  const payload: ChatTokenPayload = {
    sessionToken,
    userId,
    email,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
  };

  return encryptChatToken(payload, secret);
}
