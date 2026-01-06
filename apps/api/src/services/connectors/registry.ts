/**
 * Connector Registry
 *
 * Central hub for managing all connectors. Provides:
 * - Discovery of available connectors
 * - Lookup of user/team connections
 * - Unified interface for connector operations
 *
 * This does NOT interact with Convex directly. It manages OAuth tokens
 * and credentials in our PostgreSQL database. Shared connectors inject
 * their credentials into Convex env vars when setting up user apps.
 */

import { prisma } from "@shipper/database";
import type {
  PersonalConnectorProvider,
  SharedConnectorType,
} from "@shipper/database";
import type {
  PersonalConnectorDefinition,
  SharedConnectorDefinition,
  PersonalConnection,
  SharedConnection,
  ConnectorRegistryState,
} from "./types.js";
import { decrypt, encrypt } from "./encryption.js";

// ============================================================================
// Registry Class
// ============================================================================

class ConnectorRegistry {
  private personalConnectors: Map<
    PersonalConnectorProvider,
    PersonalConnectorDefinition
  > = new Map();
  private sharedConnectors: Map<
    SharedConnectorType,
    SharedConnectorDefinition
  > = new Map();

  /**
   * Register a personal connector (Notion, Linear, etc.)
   */
  registerPersonal(connector: PersonalConnectorDefinition): void {
    this.personalConnectors.set(connector.id, connector);
  }

  /**
   * Register a shared connector (Stripe, Supabase, etc.)
   */
  registerShared(connector: SharedConnectorDefinition): void {
    this.sharedConnectors.set(connector.id, connector);
  }

  // ==========================================================================
  // Discovery Methods
  // ==========================================================================

  /**
   * Get all available personal connectors
   */
  listPersonalConnectors(): PersonalConnectorDefinition[] {
    return Array.from(this.personalConnectors.values());
  }

  /**
   * Get all available shared connectors
   */
  listSharedConnectors(): SharedConnectorDefinition[] {
    return Array.from(this.sharedConnectors.values());
  }

  /**
   * Get a specific personal connector by provider
   */
  getPersonalConnector(
    provider: PersonalConnectorProvider,
  ): PersonalConnectorDefinition | undefined {
    return this.personalConnectors.get(provider);
  }

  /**
   * Get a specific shared connector by type
   */
  getSharedConnector(
    type: SharedConnectorType,
  ): SharedConnectorDefinition | undefined {
    return this.sharedConnectors.get(type);
  }

  // ==========================================================================
  // User Connection Methods
  // ==========================================================================

  /**
   * Get all personal connections for a user
   */
  async getUserPersonalConnections(
    userId: string,
  ): Promise<PersonalConnection[]> {
    const connections = await prisma.personalConnector.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return connections.map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      status: conn.status,
      metadata: conn.metadata as Record<string, unknown> | undefined,
      connectedAt: conn.createdAt,
      lastUsedAt: conn.lastUsedAt ?? undefined,
      errorMessage: conn.errorMessage ?? undefined,
    }));
  }

  /**
   * Get a specific personal connection
   */
  async getUserPersonalConnection(
    userId: string,
    provider: PersonalConnectorProvider,
  ): Promise<PersonalConnection | null> {
    const connection = await prisma.personalConnector.findFirst({
      where: { userId, provider },
    });

    if (!connection) return null;

    return {
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      metadata: connection.metadata as Record<string, unknown> | undefined,
      connectedAt: connection.createdAt,
      lastUsedAt: connection.lastUsedAt ?? undefined,
      errorMessage: connection.errorMessage ?? undefined,
    };
  }

  /**
   * Get decrypted access token for a personal connection
   */
  async getPersonalAccessToken(
    userId: string,
    provider: PersonalConnectorProvider,
  ): Promise<string | null> {
    const connection = await prisma.personalConnector.findFirst({
      where: { userId, provider, status: "ACTIVE" },
    });

    if (!connection) {
      return null;
    }

    // Check if token is expired and refresh if needed
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      // Try to refresh
      const connector = this.getPersonalConnector(provider);
      if (!connector?.refreshToken || !connection.refreshToken) {
        return null;
      }

      try {
        const decryptedRefresh = decrypt(connection.refreshToken);
        const metadata = connection.metadata as
          | Record<string, unknown>
          | undefined;

        const newTokens = await connector.refreshToken(
          decryptedRefresh,
          metadata,
        );

        await prisma.personalConnector.update({
          where: { id: connection.id },
          data: {
            accessToken: encrypt(newTokens.accessToken),
            refreshToken: newTokens.refreshToken
              ? encrypt(newTokens.refreshToken)
              : connection.refreshToken,
            expiresAt: newTokens.expiresAt,
            status: "ACTIVE",
            errorMessage: null,
          },
        });

        return newTokens.accessToken;
      } catch (error) {
        await prisma.personalConnector.update({
          where: { id: connection.id },
          data: {
            status: "EXPIRED",
            errorMessage: `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
        return null;
      }
    }

    return decrypt(connection.accessToken);
  }

  // ==========================================================================
  // Team/Project Connection Methods
  // ==========================================================================

  /**
   * Get all shared connections for a team
   */
  async getTeamSharedConnections(teamId: string): Promise<SharedConnection[]> {
    const connections = await prisma.sharedConnector.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
    });

    return connections.map((conn) => ({
      id: conn.id,
      connectorType: conn.connectorType,
      name: conn.name ?? undefined,
      status: conn.status,
      enabled: conn.enabled,
      configuredAt: conn.createdAt,
      configuredBy: conn.createdById,
      lastUsedAt: conn.lastUsedAt ?? undefined,
      errorMessage: conn.errorMessage ?? undefined,
    }));
  }

  /**
   * Get all shared connections for a project
   */
  async getProjectSharedConnections(
    projectId: string,
  ): Promise<SharedConnection[]> {
    const connections = await prisma.sharedConnector.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return connections.map((conn) => ({
      id: conn.id,
      connectorType: conn.connectorType,
      name: conn.name ?? undefined,
      status: conn.status,
      enabled: conn.enabled,
      configuredAt: conn.createdAt,
      configuredBy: conn.createdById,
      lastUsedAt: conn.lastUsedAt ?? undefined,
      errorMessage: conn.errorMessage ?? undefined,
    }));
  }

  /**
   * Get decrypted credentials for a shared connection
   */
  async getSharedCredentials(
    connectionId: string,
  ): Promise<Record<string, string> | null> {
    const connection = await prisma.sharedConnector.findUnique({
      where: { id: connectionId },
    });

    if (!connection || !connection.enabled || connection.status !== "ACTIVE") {
      return null;
    }

    try {
      const decrypted = decrypt(connection.credentials);
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Full State Methods
  // ==========================================================================

  /**
   * Get complete connector state for a user (for settings page)
   */
  async getConnectorState(
    userId: string,
    teamId?: string,
  ): Promise<ConnectorRegistryState> {
    const [personalConnections, sharedConnections] = await Promise.all([
      this.getUserPersonalConnections(userId),
      teamId ? this.getTeamSharedConnections(teamId) : Promise.resolve([]),
    ]);

    return {
      personal: {
        available: this.listPersonalConnectors(),
        connected: personalConnections,
      },
      shared: {
        available: this.listSharedConnectors(),
        configured: sharedConnections,
      },
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const connectorRegistry = new ConnectorRegistry();

// Re-export types
export type {
  PersonalConnectorDefinition,
  SharedConnectorDefinition,
  PersonalConnection,
  SharedConnection,
  ConnectorRegistryState,
} from "./types.js";
