/**
 * Convex Management API Types
 *
 * These types define the shape of data used when interacting with
 * the Convex Management API for Shipper Cloud deployments.
 */
/**
 * Type guard for ConvexAPIError
 */
export function isConvexAPIError(error) {
    return (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        "message" in error &&
        "status" in error);
}
//# sourceMappingURL=types.js.map