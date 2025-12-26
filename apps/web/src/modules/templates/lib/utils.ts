/**
 * Template Utilities
 * Helper functions for template display and formatting
 */

/**
 * Format large numbers with abbreviations (1.2k, 5.3M, etc.)
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return num.toString();
}

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Get a color class for category badges
 */
export function getCategoryColor(categorySlug: string): string {
  const colors: Record<string, string> = {
    "landing-pages": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "ecommerce": "bg-green-500/10 text-green-600 dark:text-green-400",
    "dashboards": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    "apps": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    "forms-tools": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    "creative": "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  };
  return colors[categorySlug] || "bg-gray-500/10 text-gray-600 dark:text-gray-400";
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

/**
 * Get gradient background for template cards without thumbnails
 */
export function getGradientForTemplate(templateId: string): string {
  const gradients = [
    "from-blue-500 to-purple-600",
    "from-green-500 to-teal-600",
    "from-orange-500 to-red-600",
    "from-pink-500 to-rose-600",
    "from-indigo-500 to-blue-600",
    "from-yellow-500 to-orange-600",
  ];
  
  // Use template ID to deterministically select a gradient
  const hash = templateId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

