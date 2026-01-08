/**
 * Connector System
 *
 * Central export for the connector system. Import connectors here
 * and register them with the registry.
 *
 * Usage:
 *   import { connectorRegistry } from './connectors';
 *   const notionConnector = connectorRegistry.getPersonalConnector('NOTION');
 */

export { connectorRegistry } from "./registry.js";
export {
  encrypt,
  decrypt,
  encryptCredentials,
  decryptCredentials,
} from "./encryption.js";
export type {
  PersonalConnectorDefinition,
  SharedConnectorDefinition,
  PersonalConnection,
  SharedConnection,
  ConnectorRegistryState,
  TokenResponse,
  Resource,
  ResourceQuery,
} from "./types.js";

// =============================================================================
// Register Connectors
// =============================================================================
// Import and register connectors here. Each connector is a separate file
// that implements the PersonalConnectorDefinition or SharedConnectorDefinition.

import { connectorRegistry } from "./registry.js";

// Personal Connectors (MCP / Context Providers)
import { notionConnector } from "./personal/notion.js";
connectorRegistry.registerPersonal(notionConnector);

import { linearConnector } from "./personal/linear.js";
connectorRegistry.registerPersonal(linearConnector);
// Import and register elevenlabs connector if available
// Note: This file may not exist in main branch - if import fails, module will still export connectorRegistry
import { elevenlabsConnector } from "./personal/elevenlabs.js";
connectorRegistry.registerPersonal(elevenlabsConnector);

// import { linearConnector } from "./personal/linear.js";
// connectorRegistry.registerPersonal(linearConnector);

import { atlassianConnector } from "./personal/atlassian.js";
connectorRegistry.registerPersonal(atlassianConnector);

// Shared Connectors (App Feature Providers)
// These extend the capabilities of generated apps
// Uncomment as they are implemented:
import { stripeConnector } from "./shared/stripe.js";
connectorRegistry.registerShared(stripeConnector);

import { supabaseConnector } from "./shared/supabase.js";
connectorRegistry.registerShared(supabaseConnector);

// Resend - Email service
import { resendConnector } from "./shared/resend.js";
connectorRegistry.registerShared(resendConnector);
