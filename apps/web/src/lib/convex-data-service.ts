/**
 * Convex Data Service
 *
 * Provides methods to query Convex deployment data via the Streaming Export API.
 * Uses deploy keys for authentication to read tables, schemas, and documents.
 *
 * @see https://docs.convex.dev/streaming-export-api
 */

import { decryptDeployKey } from "@shipper/convex";

export interface ConvexTableSchema {
  name: string;
  type: string;
  description?: string;
  properties?: Record<
    string,
    {
      type: string;
      description?: string;
    }
  >;
}

export interface ConvexTableInfo {
  name: string;
  documentCount?: number;
  schema?: ConvexTableSchema;
}

export interface ConvexDocument {
  _id: string;
  _creationTime: number;
  _ts?: number;
  [key: string]: unknown;
}

export interface ConvexListSnapshotResponse {
  values: ConvexDocument[];
  hasMore: boolean;
  cursor?: string;
  snapshot?: number;
}

export interface ConvexSchemasResponse {
  tables: Record<string, ConvexTableSchema>;
}

export interface ConvexUserInfo {
  _id: string; // Better Auth uses 'id' but we normalize to _id for UI compatibility
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  _creationTime: number; // Better Auth uses 'createdAt' but we normalize to _creationTime for UI
}

/**
 * Convex Data Service for reading deployment data
 */
export class ConvexDataService {
  private readonly deploymentUrl: string;
  private readonly deployKey: string;

  constructor(deploymentUrl: string, encryptedDeployKey: string) {
    this.deploymentUrl = deploymentUrl.replace(/\/$/, "");
    this.deployKey = decryptDeployKey(encryptedDeployKey);
  }

  /**
   * Get the authorization header for Streaming Export API
   */
  private getAuthHeader(): Record<string, string> {
    return {
      Authorization: `Convex ${this.deployKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * List all tables and their schemas
   */
  async getTablesAndSchemas(): Promise<ConvexTableInfo[]> {
    try {
      const response = await fetch(
        `${this.deploymentUrl}/api/json_schemas?format=json`,
        {
          method: "GET",
          headers: this.getAuthHeader(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ConvexDataService] Failed to get schemas:", response.status, errorText);
        throw new Error(`Failed to get schemas: ${response.status}`);
      }

      const data = await response.json();

      // The response contains table schemas
      const tables: ConvexTableInfo[] = [];

      if (data.tables) {
        for (const [tableName, schema] of Object.entries(data.tables)) {
          // Skip internal tables (starting with _)
          if (tableName.startsWith("_")) continue;

          tables.push({
            name: tableName,
            schema: schema as ConvexTableSchema,
          });
        }
      }

      return tables;
    } catch (error) {
      console.error("[ConvexDataService] Error getting tables:", error);
      throw error;
    }
  }

  /**
   * Get documents from a table with pagination
   */
  async getTableDocuments(
    tableName: string,
    options: {
      cursor?: string;
      limit?: number;
      snapshot?: number;
    } = {}
  ): Promise<ConvexListSnapshotResponse> {
    try {
      const params = new URLSearchParams({
        format: "json",
        tableName,
      });

      if (options.cursor) {
        params.append("cursor", options.cursor);
      }

      if (options.snapshot) {
        params.append("snapshot", options.snapshot.toString());
      }

      const response = await fetch(
        `${this.deploymentUrl}/api/list_snapshot?${params.toString()}`,
        {
          method: "GET",
          headers: this.getAuthHeader(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[ConvexDataService] Failed to get documents:", response.status, errorText);
        throw new Error(`Failed to get documents: ${response.status}`);
      }

      const data = await response.json();

      // Apply limit if specified
      const values = options.limit
        ? data.values?.slice(0, options.limit) ?? []
        : data.values ?? [];

      return {
        values,
        hasMore: data.hasMore ?? false,
        cursor: data.cursor,
        snapshot: data.snapshot,
      };
    } catch (error) {
      console.error("[ConvexDataService] Error getting documents:", error);
      throw error;
    }
  }

  /**
   * Get all available table names (including component tables)
   * This is useful for debugging and discovering the correct table names
   */
  async getAllTableNames(includeSystemTables = true): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.deploymentUrl}/api/json_schemas?format=json`,
        {
          method: "GET",
          headers: this.getAuthHeader(),
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (!data.tables) return [];

      // Return all tables, optionally including system tables (prefixed with _)
      return Object.keys(data.tables).filter(
        (name) => includeSystemTables || !name.startsWith("_")
      );
    } catch {
      return [];
    }
  }

  /**
   * Call a Convex query function via HTTP
   * This is useful for calling component functions that may not be exposed via streaming export
   */
  async callQuery<T>(
    functionPath: string,
    args: Record<string, unknown> = {}
  ): Promise<T | null> {
    try {
      const response = await fetch(`${this.deploymentUrl}/api/query`, {
        method: "POST",
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          path: functionPath,
          args,
          format: "json",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ConvexDataService] Query ${functionPath} failed:`,
          response.status,
          errorText
        );
        return null;
      }

      // Convex HTTP API wraps the result in { status, value, logLines }
      const data = (await response.json()) as {
        status: "success" | "error";
        value?: T;
        errorMessage?: string;
        logLines?: string[];
      };

      if (data.status === "error") {
        console.error(
          `[ConvexDataService] Query ${functionPath} returned error:`,
          data.errorMessage
        );
        return null;
      }

      return data.value ?? null;
    } catch (error) {
      console.error(`[ConvexDataService] Query ${functionPath} error:`, error);
      return null;
    }
  }

  /**
   * Call a Convex mutation function via HTTP
   * Used for write operations like creating or deleting users
   */
  async callMutation<T>(
    functionPath: string,
    args: Record<string, unknown> = {}
  ): Promise<{ success: boolean; value?: T; error?: string }> {
    try {
      const response = await fetch(`${this.deploymentUrl}/api/mutation`, {
        method: "POST",
        headers: this.getAuthHeader(),
        body: JSON.stringify({
          path: functionPath,
          args,
          format: "json",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ConvexDataService] Mutation ${functionPath} failed:`,
          response.status,
          errorText
        );
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }

      // Convex HTTP API wraps the result in { status, value, logLines }
      const data = (await response.json()) as {
        status: "success" | "error";
        value?: T;
        errorMessage?: string;
        logLines?: string[];
      };

      if (data.status === "error") {
        console.error(
          `[ConvexDataService] Mutation ${functionPath} returned error:`,
          data.errorMessage
        );
        return { success: false, error: data.errorMessage };
      }

      return { success: true, value: data.value };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[ConvexDataService] Mutation ${functionPath} error:`, error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get all users from the Convex deployment
   * Uses the auth:listAllUsers query via deploy key + HTTP API
   */
  async getUsers(limit = 100): Promise<ConvexUserInfo[]> {
    try {
      // Primary method: Call the listAllUsers query via HTTP API with deploy key
      console.log(`[ConvexDataService] Fetching users via auth:listAllUsers query`);

      const result = await this.callQuery<Array<{
        id: string;
        name?: string | null;
        email: string;
        emailVerified: boolean;
        image?: string | null;
        createdAt: string | number;
      }>>("auth:listAllUsers", { limit });

      if (result && result.length > 0) {
        console.log(`[ConvexDataService] Found ${result.length} users via listAllUsers query`);
        return result.map((user) => ({
          _id: user.id,
          name: user.name ?? "",
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image ?? null,
          _creationTime: this.normalizeTimestamp(user.createdAt),
        }));
      }

      if (result && result.length === 0) {
        console.log("[ConvexDataService] No users found (empty array from query)");
        return [];
      }

      // Fallback: Try system query for component tables
      console.log("[ConvexDataService] Falling back to system query...");
      for (const tableName of ["betterAuth:user", "user", "users"]) {
        const sysResult = await this.callQuery<{
          page: Array<{
            _id: string;
            id?: string;
            name?: string;
            email?: string;
            emailVerified?: boolean;
            image?: string | null;
            createdAt?: string | number;
            _creationTime: number;
          }>;
          isDone: boolean;
        }>("_system/frontend/paginatedTableDocuments", {
          paginationOpts: { numItems: limit, cursor: null },
          table: tableName,
          filters: null,
        });

        if (sysResult?.page && sysResult.page.length > 0) {
          console.log(`[ConvexDataService] Found ${sysResult.page.length} users via system query for "${tableName}"`);
          return this.normalizeUserDocuments(sysResult.page);
        }
      }

      console.log("[ConvexDataService] No users found via any method");
      return [];
    } catch (error) {
      console.error("[ConvexDataService] Error fetching users:", error);
      return [];
    }
  }

  /**
   * Normalize user documents from system query format to ConvexUserInfo
   */
  private normalizeUserDocuments(
    docs: Array<Record<string, unknown>>
  ): ConvexUserInfo[] {
    return docs.map((doc) => ({
      _id: (doc.id as string) ?? (doc._id as string) ?? "",
      name: (doc.name as string) ?? "",
      email: (doc.email as string) ?? "",
      emailVerified: (doc.emailVerified as boolean) ?? false,
      image: (doc.image as string) ?? null,
      _creationTime: this.normalizeTimestamp(doc.createdAt ?? doc._creationTime),
    }));
  }

  /**
   * Normalize timestamp to milliseconds
   */
  private normalizeTimestamp(value: unknown): number {
    if (typeof value === "number") {
      return value > 9999999999 ? value : value * 1000;
    }
    if (typeof value === "string") {
      return new Date(value).getTime();
    }
    return Date.now();
  }

  /**
   * Create a new user in the Convex deployment
   * Uses Better Auth's HTTP sign-up endpoint
   */
  async createUser(userData: {
    email: string;
    name?: string;
    password: string;
  }): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      // Get the site URL for Better Auth (convex.site domain)
      const siteUrl = this.deploymentUrl.replace(".cloud", ".site");

      // Call Better Auth's sign-up endpoint
      const response = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          name: userData.name ?? "",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          (errorData as { message?: string }).message ||
          `HTTP ${response.status}`;
        console.error(
          "[ConvexDataService] Better Auth sign-up failed:",
          errorMessage
        );
        return { success: false, error: errorMessage };
      }

      const result = (await response.json()) as { user?: { id: string } };
      console.log(
        `[ConvexDataService] Created user ${userData.email} via Better Auth`
      );
      return { success: true, userId: result.user?.id };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[ConvexDataService] Error creating user:", error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Delete a user from the Convex deployment
   * Note: Better Auth requires the admin plugin for user deletion.
   * This is a best-effort implementation that tries available methods.
   */
  async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the site URL for Better Auth (convex.site domain)
      const siteUrl = this.deploymentUrl.replace(".cloud", ".site");

      // Try Better Auth's admin remove-user endpoint
      // Note: This requires the admin plugin to be enabled and proper auth
      const response = await fetch(`${siteUrl}/api/auth/admin/remove-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        console.log(`[ConvexDataService] Deleted user ${userId} via admin API`);
        return { success: true };
      }

      // If admin API fails, return the error
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as { message?: string }).message ||
        "User deletion requires the Better Auth admin plugin to be enabled";

      console.error("[ConvexDataService] Delete user failed:", errorMessage);
      return { success: false, error: errorMessage };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[ConvexDataService] Error deleting user:", error);
      return {
        success: false,
        error: `Failed to delete user: ${errorMsg}. Admin plugin may not be enabled.`,
      };
    }
  }

  /**
   * Get table row count
   */
  async getTableRowCount(tableName: string): Promise<number> {
    try {
      // Get a snapshot and count rows
      // Note: For large tables, this may need pagination
      let count = 0;
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const result = await this.getTableDocuments(tableName, { cursor });
        count += result.values.length;
        hasMore = result.hasMore;
        cursor = result.cursor;

        // Safety limit to prevent infinite loops
        if (count > 10000) {
          console.warn("[ConvexDataService] Row count exceeded 10000, stopping");
          break;
        }
      }

      return count;
    } catch (error) {
      console.error("[ConvexDataService] Error getting row count:", error);
      return 0;
    }
  }
}

/**
 * Create a ConvexDataService for a project
 */
export async function createConvexDataServiceForProject(
  deploymentUrl: string,
  encryptedDeployKey: string
): Promise<ConvexDataService> {
  return new ConvexDataService(deploymentUrl, encryptedDeployKey);
}
