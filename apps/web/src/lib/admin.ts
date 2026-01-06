/**
 * Lightning-fast admin access control utilities
 */

// Parse admin accounts from environment variable
const getAdminAccounts = (): string[] => {
  const adminAccountsEnv = process.env.ADMIN_ACCOUNT;

  if (!adminAccountsEnv) {
    console.warn("⚠️ ADMIN_ACCOUNT environment variable not set");
    return [];
  }

  try {
    // Handle JSON array format
    if (adminAccountsEnv.startsWith("[") && adminAccountsEnv.endsWith("]")) {
      const jsonArray = JSON.parse(adminAccountsEnv);
      // Flatten any comma-separated emails within array elements
      return jsonArray.flatMap((item: string) => {
        if (typeof item === "string" && item.includes(",")) {
          return item
            .split(",")
            .map((email: string) => email.trim())
            .filter((email: string) => email.length > 0);
        }
        return [item];
      });
    }
    // Handle comma-separated emails
    else if (adminAccountsEnv.includes(",")) {
      return adminAccountsEnv
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0);
    }
    // Handle single email
    else {
      return [adminAccountsEnv.trim()];
    }
  } catch (error) {
    console.error(
      "❌ Failed to parse ADMIN_ACCOUNT environment variable:",
      error
    );
    return [];
  }
};

// Cache admin accounts for performance
const ADMIN_ACCOUNTS = getAdminAccounts();

/**
 * Lightning-fast admin check - O(1) lookup using Set
 */
const ADMIN_EMAIL_SET = new Set(ADMIN_ACCOUNTS);

/**
 * Check if an email has admin access
 * @param email - User email to check
 * @returns true if user is admin, false otherwise
 */
export const isAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAIL_SET.has(email);
};

/**
 * Get all admin accounts (for debugging/logging)
 */
export const getAdminEmailList = (): string[] => {
  return [...ADMIN_ACCOUNTS];
};

/**
 * Admin access error message
 */
export const ADMIN_ACCESS_DENIED_MESSAGE =
  "❌ Access denied. Admin privileges required.";
