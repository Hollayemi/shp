/**
 * Shared utility functions that can be used across apps
 */
export declare function formatDate(date: Date): string;
export declare function parseDate(dateString: string): Date;
export declare function sleep(ms: number): Promise<void>;
export declare function isValidEmail(email: string): boolean;
export declare function generateId(): string;
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
export declare function validateEslintOutput(exitCode: number | undefined, stdout: string | undefined): string | null;
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
export declare function transformModalUrlForDisplay(modalUrl: string, projectId: string, env?: {
    NODE_ENV?: string;
    SKIP_MODAL_URL_TRANSFORM?: string;
    NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM?: string;
    MODAL_USE_LOCALHOST?: string;
    NEXT_PUBLIC_MODAL_USE_LOCALHOST?: string;
}): string;
//# sourceMappingURL=index.d.ts.map