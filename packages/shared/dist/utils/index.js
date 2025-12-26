"use strict";
/**
 * Shared utility functions that can be used across apps
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = formatDate;
exports.parseDate = parseDate;
exports.sleep = sleep;
exports.isValidEmail = isValidEmail;
exports.generateId = generateId;
exports.validateEslintOutput = validateEslintOutput;
exports.transformModalUrlForDisplay = transformModalUrlForDisplay;
function formatDate(date) {
    return date.toISOString();
}
function parseDate(dateString) {
    return new Date(dateString);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Validates ESLint command output and extracts valid JSON if present.
 *
 * ESLint returns:
 * - Exit code 0: No errors found
 * - Exit code 1: Errors found
 * - Other exit codes: Command failed
 *
 * @param exitCode - The exit code from the ESLint command (may be undefined)
 * @param stdout - The stdout output from the ESLint command (may be undefined)
 * @returns The JSON string if valid, null otherwise
 */
function validateEslintOutput(exitCode, stdout) {
    // Only parse if the command succeeded and returned valid JSON
    if (exitCode === 0 || exitCode === 1) {
        // ESLint returns 0 for no errors, 1 for errors found
        if (stdout && stdout.trim().startsWith("[")) {
            return stdout;
        }
    }
    return null;
}
/**
 * Transform Modal URL to user-facing Shipper domain for display purposes
 * This is used for "Open in new tab" button and AI messages
 * The iframe still uses the direct Modal URL
 *
 * @param modalUrl - The original Modal sandbox URL
 * @param projectId - The project ID
 * @param env - Environment variables object (allows passing process.env or custom env)
 * @returns The transformed URL or original if transformation is skipped
 */
function transformModalUrlForDisplay(modalUrl, projectId, env = {}) {
    try {
        const url = new URL(modalUrl);
        // Check if URL is already transformed for this specific project
        const isAlreadyTransformed = url.hostname.includes(`preview--m-${projectId}`);
        if (isAlreadyTransformed) {
            return modalUrl;
        }
        // Skip transformation if explicitly disabled (for staging/preview environments)
        // Support both API and Web environment variable names
        const skipTransform = env.SKIP_MODAL_URL_TRANSFORM === "true" ||
            env.NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM === "true";
        if (skipTransform) {
            return modalUrl;
        }
        // Transform to user-facing domain
        // Support both API and Web environment variable names
        const useLocalhost = env.NODE_ENV === "development" ||
            env.MODAL_USE_LOCALHOST === "true" ||
            env.NEXT_PUBLIC_MODAL_USE_LOCALHOST === "true";
        if (useLocalhost) {
            url.hostname = `preview--m-${projectId}.localhost`;
            url.port = "3003";
            url.protocol = "http:";
        }
        else {
            url.hostname = `preview--m-${projectId}.shipper.now`;
        }
        return url.toString();
    }
    catch (error) {
        // If URL parsing fails, return original
        return modalUrl;
    }
}
//# sourceMappingURL=index.js.map