/**
 * Shared utility functions that can be used across apps
 */

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function generateId(): string {
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
export function validateEslintOutput(exitCode: number | undefined, stdout: string | undefined): string | null {
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
export function transformModalUrlForDisplay(
  modalUrl: string,
  projectId: string,
  env: {
    NODE_ENV?: string;
    SKIP_MODAL_URL_TRANSFORM?: string;
    NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM?: string;
    MODAL_USE_LOCALHOST?: string;
    NEXT_PUBLIC_MODAL_USE_LOCALHOST?: string;
  } = {}
): string {
  try {
    const url = new URL(modalUrl);

    // Check if URL is already transformed for this specific project
    const isAlreadyTransformed = url.hostname.includes(
      `preview--m-${projectId}`,
    );

    if (isAlreadyTransformed) {
      return modalUrl;
    }

    // Skip transformation if explicitly disabled (for staging/preview environments)
    // Support both API and Web environment variable names
    const skipTransform =
      env.SKIP_MODAL_URL_TRANSFORM === "true" ||
      env.NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM === "true";

    if (skipTransform) {
      return modalUrl;
    }

    // Transform to user-facing domain
    // Support both API and Web environment variable names
    const useLocalhost =
      env.NODE_ENV === "development" ||
      env.MODAL_USE_LOCALHOST === "true" ||
      env.NEXT_PUBLIC_MODAL_USE_LOCALHOST === "true";

    if (useLocalhost) {
      url.hostname = `preview--m-${projectId}.localhost`;
      url.port = "3003";
      url.protocol = "http:";
    } else {
      url.hostname = `preview--m-${projectId}.shipper.now`;
    }

    return url.toString();
  } catch (error) {
    // If URL parsing fails, return original
    return modalUrl;
  }
}

