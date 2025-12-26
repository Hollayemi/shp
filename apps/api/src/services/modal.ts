/**
 * Modal Client Configuration
 *
 * This file provides utilities for Modal configuration.
 * Modal is a serverless cloud platform for running code in containers.
 *
 * The actual ModalClient is initialized in modal-sandbox-manager.ts
 */

/**
 * Check if Modal is properly configured
 */
export function isModalConfigured(): boolean {
  return !!(process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET);
}

/**
 * Get Modal configuration status
 */
export function getModalStatus() {
  return {
    configured: isModalConfigured(),
    tokenIdSet: !!process.env.MODAL_TOKEN_ID,
    tokenSecretSet: !!process.env.MODAL_TOKEN_SECRET,
  };
}

// Log configuration status on module load
if (!isModalConfigured()) {
  console.warn(
    "[Modal] MODAL_TOKEN_ID or MODAL_TOKEN_SECRET environment variable not set. Modal functionality will be limited.",
  );
} else {
  console.log("[Modal] Modal SDK configured successfully");
}
