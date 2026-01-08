/**
 * Connectors tRPC Procedures
 *
 * Handles connector management operations:
 * - List available connectors and connection status
 * - Initiate OAuth flow
 * - Disconnect connectors
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const connectorsRouter = createTRPCRouter({
  /**
   * Get all connectors and their connection status for the current user
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const response = await fetch(`${API_URL}/api/v1/connectors`, {
      headers: {
        "x-user-id": ctx.session.user.id,
        "x-team-id": "",
      },
    });

    if (!response.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch connectors",
      });
    }

    const data = await response.json();
    return data.data;
  }),

  /**
   * Get OAuth URL to initiate connection for a provider
   */
  getOAuthUrl: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await fetch(
        `${API_URL}/api/v1/connectors/${input.provider}/auth`,
        {
          headers: {
            "x-user-id": ctx.session.user.id,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.error || "Failed to get OAuth URL",
        });
      }

      const data = await response.json();
      return { authUrl: data.authUrl };
    }),

  /**
   * Get connection status for a specific provider
   */
  getStatus: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ ctx, input }) => {
      const response = await fetch(
        `${API_URL}/api/v1/connectors/${input.provider}/status`,
        {
          headers: {
            "x-user-id": ctx.session.user.id,
          },
        },
      );

      if (!response.ok) {
        return { connected: false, connection: null };
      }

      const data = await response.json();
      // API returns { success, connected, connection } directly, not wrapped in data
      return { connected: data.connected, connection: data.connection };
    }),

  /**
   * Connect using API key (for non-OAuth providers like ElevenLabs)
   */
  connectWithApiKey: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        apiKey: z.string().min(1, "API key is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await fetch(
        `${API_URL}/api/v1/connectors/${input.provider}/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": ctx.session.user.id,
          },
          body: JSON.stringify({
            apiKey: input.apiKey,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.error || "Failed to connect with API key",
        });
      }

      const data = await response.json();
      return { success: true, metadata: data.metadata };
    }),

  /**
   * Refresh metadata for a connector (fetches latest from provider)
   */
  refreshStatus: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await fetch(
        `${API_URL}/api/v1/connectors/${input.provider}/refresh`,
        {
          method: "POST",
          headers: {
            "x-user-id": ctx.session.user.id,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.error || "Failed to refresh status",
        });
      }

      const data = await response.json();
      return {
        success: true,
        metadata: data.metadata,
        capabilities: data.capabilities,
      };
    }),

  /**
   * Disconnect a provider
   */
  disconnect: protectedProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const response = await fetch(
        `${API_URL}/api/v1/connectors/${input.provider}`,
        {
          method: "DELETE",
          headers: {
            "x-user-id": ctx.session.user.id,
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.error || "Failed to disconnect",
        });
      }

      return { success: true };
    }),

  /**
   * Fetch resources from a connected provider
   */
  fetchResources: protectedProcedure
    .input(
      z.object({
        provider: z.string(),
        resourceType: z.string(),
        query: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await fetch(
        `${API_URL}/api/v1/connectors/${input.provider}/resources`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": ctx.session.user.id,
          },
          body: JSON.stringify({
            resourceType: input.resourceType,
            query: input.query,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.error || "Failed to fetch resources",
        });
      }

      const data = await response.json();
      // API returns { success, resources, count } directly, not wrapped in data
      return data.resources;
    }),
});
