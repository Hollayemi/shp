/**
 * Chat Token Encryption/Decryption
 *
 * Provides secure token generation for cross-origin chat authentication.
 * Tokens contain session information encrypted with AES-256-GCM.
 */
export interface ChatTokenPayload {
    sessionToken: string;
    userId: string;
    email: string;
    expiresAt: number;
}
/**
 * Encrypt chat token payload
 */
export declare function encryptChatToken(payload: ChatTokenPayload, secret: string): string;
/**
 * Decrypt chat token
 */
export declare function decryptChatToken(encryptedToken: string, secret: string): ChatTokenPayload | null;
/**
 * Create a chat token with 1 hour expiration
 */
export declare function createChatToken(sessionToken: string, userId: string, email: string, secret: string): string;
//# sourceMappingURL=chat-token.d.ts.map