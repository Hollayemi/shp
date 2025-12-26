/**
 * Connector System Types
 *
 * Defines the interfaces for both Personal and Shared connectors.
 * Personal connectors bring context INTO the AI builder (Notion, Linear, Jira).
 * Shared connectors extend the capabilities OF generated apps (Stripe, Supabase).
 */

import type {
  PersonalConnectorProvider,
  SharedConnectorType,
  ConnectorStatus,
} from "@shipper/database";

// ============================================================================
// Common Types
// ============================================================================

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ResourceQuery {
  resourceType: string;
  query?: string;
  limit?: number;
  cursor?: string;
}

export interface Resource {
  id: string;
  type: string;
  name: string;
  description?: string;
  url?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Personal Connector Types (MCP / Context Providers)
// ============================================================================

export interface PersonalConnectorDefinition {
  // Identity
  id: PersonalConnectorProvider;
  name: string;
  description: string;
  icon: string;

  // Auth configuration
  auth: {
    type: "oauth" | "mcp" | "api_key";
    // OAuth config
    authUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
    // MCP config (for providers like Notion that host their own MCP server)
    mcpServerUrl?: string;
  };

  // What this connector can do
  capabilities: {
    read: string[]; // e.g., ["pages", "databases", "issues"]
    write: string[]; // e.g., ["comments"]
  };

  // Methods
  getAuthUrl(redirectUri: string, state: string): string;
  handleCallback(
    code: string,
    redirectUri: string,
    state?: string,
  ): Promise<TokenResponse>;
  refreshToken?(
    refreshToken: string,
    metadata?: Record<string, unknown>,
  ): Promise<TokenResponse>;
  fetchResources(
    accessToken: string,
    query: ResourceQuery,
  ): Promise<Resource[]>;

  // Optional: Check if connection is still valid
  validateConnection?(accessToken: string): Promise<boolean>;
}

// ============================================================================
// Shared Connector Types (App Feature Providers)
// ============================================================================

export interface SharedConnectorCredentials {
  [key: string]: string; // e.g., { apiKey: "sk_...", secretKey: "..." }
}

export interface SharedConnectorDefinition {
  // Identity
  id: SharedConnectorType;
  name: string;
  description: string;
  icon: string;

  // What credentials are needed
  requiredCredentials: {
    key: string;
    label: string;
    placeholder?: string;
    pattern?: RegExp;
    helpUrl?: string;
  }[];

  // What this connector enables in generated apps
  capabilities: string[]; // e.g., ["payments", "subscriptions", "invoices"]

  // Methods
  validateCredentials(credentials: SharedConnectorCredentials): Promise<{
    valid: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
  }>;

  // How to inject into user's app (Convex env vars, code generation, etc.)
  getSetupInstructions(credentials: SharedConnectorCredentials): {
    envVars?: Record<string, string>;
    packages?: string[];
    codeTemplates?: { path: string; content: string }[];
  };
}

// ============================================================================
// Connection State Types
// ============================================================================

export interface PersonalConnection {
  id: string;
  provider: PersonalConnectorProvider;
  status: ConnectorStatus;
  metadata?: Record<string, unknown>;
  connectedAt: Date;
  lastUsedAt?: Date;
  errorMessage?: string;
}

export interface SharedConnection {
  id: string;
  connectorType: SharedConnectorType;
  name?: string;
  status: ConnectorStatus;
  enabled: boolean;
  configuredAt: Date;
  configuredBy: string;
  lastUsedAt?: Date;
  errorMessage?: string;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface ConnectorRegistryState {
  personal: {
    available: PersonalConnectorDefinition[];
    connected: PersonalConnection[];
  };
  shared: {
    available: SharedConnectorDefinition[];
    configured: SharedConnection[];
  };
}
