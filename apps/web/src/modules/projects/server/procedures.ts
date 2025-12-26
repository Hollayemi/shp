import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { prisma, Prisma } from "@/lib/db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { transformModalUrlForDisplay } from "@shipper/shared";
import {
  getSandbox,
  createSandbox,
  createGitCommit,
} from "@/lib/sandbox-manager";
import {
  getPreviewAuthForSession,
  startSandbox,
  startDevServer,
  switchToGitCommit,
  deploySandboxApp,
  restoreV2FragmentInSandbox as restoreV2FragmentInDaytonaSandbox,
  restoreFilesInSandbox as restoreFilesInDaytonaSandbox,
} from "@/lib/daytona-sandbox-manager";
import { modalAPI } from "@/lib/api/modal-client";
import {
  getSandboxProvider,
  setSandboxProvider,
  getDefaultProvider,
  supportsFeature,
  type SandboxProvider,
} from "@/lib/sandbox-provider-utils";
// Removed legacy export functions - now using optimized downloadSpecificFiles and exportSandboxFilesToZip
import { GitHubService } from "@/lib/github-integration";
import {
  getDatabaseInfo,
  getDatabaseStats,
  getDatabaseUsage,
  getDatabaseTablesList,
  getTableData,
} from "@/lib/turso-manager";
// Removed legacy v2-sandbox-manager (Daytona migration) – metrics and restoration checks deprecated
import { nanoid } from "nanoid";
import { generateSlug } from "random-word-slugs";
import { inngest } from "@/inngest/client";
import { checkProjectAccess } from "@/helpers/checkProjectAccess";
import { CreditManager } from "@/lib/credits";
import { calculateCreditsFromUSD } from "@shipper/shared";
import { decryptDeployKey } from "@shipper/convex";
import { PerformanceLogger } from "@/lib/performance-logger";
import { NetworkDiagnostics } from "@/lib/network-diagnostics";
import {
  generateProjectMetadata,
  generateSlugFromName,
} from "@/lib/project-namer";
import { validateJSXContent } from "@/lib/visual-editor/tailwind-updater";
import { updateFileWithTextAST } from "@/lib/visual-editor/ast-text-updater";
import { updateFileWithTailwindAST } from "@/lib/visual-editor/ast-classname-updater";
import {
  registerCreation,
  abortCreation,
  clearCreation,
} from "../../../../../api/src/services/file-creation-registory";

// Shared constant for component snapshot context lines
const COMPONENT_SNAPSHOT_CONTEXT_LINES = 20;

async function generatePersonalTeamSlug(): Promise<string> {
  let slug: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    // Generate a slug like "personal-happy-cat" or "personal-bright-moon"
    const randomSlug = generateSlug(2, { format: "kebab" });
    slug = `personal-${randomSlug}`;

    // Check if slug already exists
    const existingTeam = await prisma.team.findUnique({
      where: { slug },
    });

    if (!existingTeam) {
      return slug;
    }

    attempts++;
  } while (attempts < maxAttempts);

  // Fallback: use nanoid if all attempts failed
  return `personal-${nanoid(10)}`;
}

// Using shared utility from @shipper/shared
// Import is at the top of the file

// Helper function to check team access
async function checkTeamAccess(
  teamId: string,
  userId: string,
  requiredRoles: string[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId,
      },
    },
  });

  return membership ? requiredRoles.includes(membership.role) : false;
}

export const improvedProjectsRouter = createTRPCRouter({
  /**
   * Get initial batch of projects for homepage (server-side rendering)
   */
  getInitial: protectedProcedure.query(async ({ ctx }) => {
    return await prisma.project.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 6, // First 6 projects for initial load
      select: {
        id: true,
        name: true,
        subtitle: true,
        logo: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            messages: true,
            v2Messages: true,
          },
        },
      },
    });
  }),

  /**
   * Get user's credits for homepage
   */
  getUserCredits: protectedProcedure.query(async ({ ctx }) => {
    return await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        creditBalance: true,
        membershipTier: true,
      },
    });
  }),

  /**
   * Check if user has an active subscription
   */
  hasActiveSubscription: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        membershipTier: true,
        membershipExpiresAt: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      return { hasActiveSubscription: false };
    }

    // User has active subscription if:
    // 1. They're not on FREE tier, AND
    // 2. They have a valid subscription ID, AND
    // 3. Membership hasn't expired (or no expiry date set)
    const hasActiveSubscription =
      user.membershipTier !== "FREE" &&
      !!user.stripeSubscriptionId &&
      (!user.membershipExpiresAt || user.membershipExpiresAt > new Date());

    return {
      hasActiveSubscription,
      membershipTier: user.membershipTier,
      expiresAt: user.membershipExpiresAt,
    };
  }),

  /**
   * Simplified fragment switching that always works reliably
   */
  getOne: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user has access to this project
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          messages: true,
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              isPersonal: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          codeImport: {
            select: {
              id: true,
              status: true,
              importedFrom: true,
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      return project;
    }),

  // Get projects by team
  getByTeam: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user has access to this team
      const hasAccess = await checkTeamAccess(input.teamId, ctx.user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found or access denied",
        });
      }

      const { limit = 20, offset = 0 } = input;
      const projects = await prisma.project.findMany({
        where: {
          teamId: input.teamId,
        },
        take: limit,
        skip: offset,
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          _count: {
            select: { messages: true },
          },
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              isPersonal: true,
            },
          },
        },
      });
      return projects;
    }),

  // Get all accessible projects (legacy + team projects)
  getMany: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit = 20, offset = 0 } = input;

      // Get all teams user is member of
      const userTeams = await prisma.teamMember.findMany({
        where: { userId: ctx.user.id },
        select: { teamId: true },
      });

      const teamIds = userTeams.map((tm) => tm.teamId);

      const projects = await prisma.project.findMany({
        where: {
          OR: [
            // Legacy personal projects
            { userId: ctx.user.id },
            // Team projects
            { teamId: { in: teamIds } },
          ],
        },
        take: limit,
        skip: offset,
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          _count: {
            select: {
              messages: true,
              v2Messages: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              isPersonal: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      return projects;
    }),

  create: protectedProcedure
    .input(
      z.object({
        value: z
          .string()
          .min(1, {
            message: "Value is required",
          })
          .max(10000, {
            message: "Value is too long",
          }),
        teamId: z.string().optional(), // Optional team ID
        creationId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Quick network health check for debugging
      NetworkDiagnostics.logNetworkHealth().catch(console.error);

      let teamId = input.teamId;
      const abortController = new AbortController();
      const creationId = input.creationId;
      if (creationId) {
        registerCreation(creationId, abortController);
      }

      // If no team specified, use user's personal team
      if (!teamId) {
        const personalTeam = await prisma.team.findFirst({
          where: {
            isPersonal: true,
            members: {
              some: {
                userId: ctx.user.id,
                role: "OWNER",
              },
            },
          },
        });

        if (!personalTeam) {
          // Create personal team if it doesn't exist
          const slug = await generatePersonalTeamSlug();
          const newPersonalTeam = await prisma.team.create({
            data: {
              name: `${ctx.user.name || ctx.user.email}'s Team`,
              description: `Personal workspace for ${
                ctx.user.name || ctx.user.email
              }`,
              slug,
              isPersonal: true,
              members: {
                create: {
                  userId: ctx.user.id,
                  role: "OWNER",
                },
              },
            },
          });
          teamId = newPersonalTeam.id;
        } else {
          teamId = personalTeam.id;
        }
      } else {
        // Check if user can create projects in this team
        const canCreate = await checkTeamAccess(teamId, ctx.user.id, [
          "OWNER",
          "ADMIN",
          "MEMBER",
        ]);

        if (!canCreate) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You don't have permission to create projects in this team",
          });
        }
      }

      // Generate AI-powered project metadata (name, subtitle, logo) with uniqueness check
      let projectMetadata: {
        name: string;
        subtitle: string;
        logo: string;
        openRouterCost?: number;
        alternativeNames?: string[];
      } | null = null;

      const maxAttempts = 5;
      let attempts = 0;
      const triedNames: string[] = [];

      try {
        // Create a checker function to validate name uniqueness
        const existingNamesChecker = async (name: string): Promise<boolean> => {
          const projectSlug = generateSlugFromName(name);
          const existingProject = await prisma.project.findFirst({
            where: { name: projectSlug },
          });
          return !!existingProject;
        };

        // Try up to 5 times to generate unique names
        while (attempts < maxAttempts) {
          attempts++;

          // If client aborted between attempts, stop early
          if (abortController.signal.aborted) {
            if (creationId) clearCreation(creationId);
            throw new TRPCError({
              code: "CLIENT_CLOSED_REQUEST",
              message: "Creation aborted by client",
            });
          }

          console.log(
            `[Projects] Generating project metadata (attempt ${attempts}/${maxAttempts})...`,
          );

          // Generate metadata with batch name generation (5 candidates)
          // The function will automatically select the first available name
          projectMetadata = await generateProjectMetadata(
            input.value,
            ctx.user.id,
            {
              existingNamesChecker,
              triedNames: triedNames.length > 0 ? triedNames : undefined,
              keepSubtitle:
                attempts > 1 && projectMetadata
                  ? projectMetadata.subtitle
                  : undefined,
              keepEmoji:
                attempts > 1 && projectMetadata
                  ? projectMetadata.logo
                  : undefined,
              abortSignal: abortController.signal,
            },
          );

          console.log(
            `[Projects] AI generated metadata (attempt ${attempts}):`,
            projectMetadata,
          );
          console.log(
            `[Projects] Alternative names generated:`,
            projectMetadata.alternativeNames,
          );

          // Check if the selected name is actually unique
          if (abortController.signal.aborted) {
            if (creationId) clearCreation(creationId);
            throw new TRPCError({
              code: "CLIENT_CLOSED_REQUEST",
              message: "Creation aborted by client",
            });
          }
          const projectSlug = generateSlugFromName(projectMetadata.name);
          const stillExists = await prisma.project.findFirst({
            where: { name: projectSlug },
          });

          if (!stillExists) {
            // Success! We found a unique name
            console.log(
              `[Projects] Unique name found: ${projectMetadata.name}`,
            );
            break;
          }

          // All 5 candidates were taken, add to tried names and retry
          console.log(
            `[Projects] All 5 candidates were taken on attempt ${attempts}`,
          );
          triedNames.push(projectMetadata.name);
          if (projectMetadata.alternativeNames) {
            triedNames.push(...projectMetadata.alternativeNames);
          }
        }

        // Final fallback: if both attempts failed, add nanoid suffix
        if (projectMetadata) {
          const projectSlug = generateSlugFromName(projectMetadata.name);
          const stillExists = await prisma.project.findFirst({
            where: { name: projectSlug },
          });

          if (stillExists) {
            const fallbackSlug = `${projectSlug}-${nanoid(6)}`;
            console.log(
              `[Projects] All ${maxAttempts} attempts exhausted, using nanoid fallback: ${fallbackSlug}`,
            );
            projectMetadata.name = fallbackSlug;
          }
        }
      } catch (error) {
        // Handle client aborts
        if (
          (error as any)?.name === "AbortError" ||
          abortController.signal.aborted
        ) {
          if (creationId) clearCreation(creationId);
          throw new TRPCError({
            code: "CLIENT_CLOSED_REQUEST",
            message: "Creation aborted by client",
          });
        }
        console.error(
          `[Projects] Failed to generate AI metadata, using fallback:`,
          error,
        );
        // Fallback to random slug if AI generation fails
        projectMetadata = {
          name: generateSlug(2, { format: "kebab" }),
          subtitle: input.value.slice(0, 50),
          logo: "🚀",
        };
      }

      // Safety check - this should never happen but makes TypeScript happy
      if (!projectMetadata) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate project metadata",
        });
      }

      // Respect abort before billing
      if (abortController.signal.aborted) {
        if (creationId) clearCreation(creationId);
        throw new TRPCError({
          code: "CLIENT_CLOSED_REQUEST",
          message: "Creation aborted by client",
        });
      }

      // Project naming is FREE - no credit charge
      // We want users to easily create projects without friction
      const openRouterCost = projectMetadata.openRouterCost || 0;

      console.log("[Projects] Project naming completed (FREE - no charge):", {
        openRouterCost,
        projectName: projectMetadata.name,
      });

      // Respect abort before DB create
      if (abortController.signal.aborted) {
        if (creationId) clearCreation(creationId);
        throw new TRPCError({
          code: "CLIENT_CLOSED_REQUEST",
          message: "Creation aborted by client",
        });
      }

      // Generate final slug from the unique name
      const projectSlug = projectMetadata.name.includes("-")
        ? projectMetadata.name
        : generateSlugFromName(projectMetadata.name);

      const createdProject = await prisma.project.create({
        data: {
          name: projectSlug, // Use slug for URL/database
          subtitle: projectMetadata.subtitle,
          logo: projectMetadata.logo,
          teamId: teamId,
          userId: ctx.user.id, // Track the creator
          messagingVersion: 2, // Use v2 messaging for new projects
          subdomain: projectSlug, // Store subdomain for custom domain fallback
          // deploymentUrl is NOT set here - it's set when the app is actually deployed
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              isPersonal: true,
            },
          },
        },
      });

      console.log(
        `[Projects] Created v2 project ${createdProject.id} with AI-generated name: ${projectMetadata.name}`,
      );

      // NOTE: Turso database provisioning removed - now using Convex for backend
      // See complexity-analyzer.ts for details on Shipper Cloud (Convex) backend

      if (creationId) clearCreation(creationId);
      return createdProject;
    }),

  cancelCreate: protectedProcedure
    .input(
      z.object({
        creationId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const aborted = abortCreation(input.creationId);
      return { aborted };
    }),

  // Update project name
  updateName: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        name: z
          .string()
          .min(1, { message: "Project name is required" })
          .max(100, { message: "Project name is too long" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user can edit this project
      const hasAccess = await checkProjectAccess(
        input.projectId,
        ctx.user.id,
        ["OWNER", "ADMIN", "MEMBER"], // Owners, admins, and members can edit
      );

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this project",
        });
      }

      // Check if the new name would conflict with existing deployments
      const existingDeployment = await prisma.deployment.findFirst({
        where: {
          OR: [{ appId: input.name }, { name: input.name }],
          // Exclude deployments from the same project
          projectId: { not: input.projectId },
        },
      });

      if (existingDeployment) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `The name "${input.name}" is already taken by another deployed app. Please choose a different name.`,
        });
      }

      // Update the project name
      const updatedProject = await prisma.project.update({
        where: { id: input.projectId },
        data: { name: input.name },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              slug: true,
              isPersonal: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return {
        success: true,
        message: "Project name updated successfully",
        project: updatedProject,
      };
    }),

  // Delete project
  delete: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user can delete this project
      const hasAccess = await checkProjectAccess(
        input.projectId,
        ctx.user.id,
        ["OWNER", "ADMIN"], // Only owners and admins can delete
      );

      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this project",
        });
      }

      await prisma.project.delete({
        where: { id: input.projectId },
      });

      return { success: true };
    }),

  /**
   * Get sandbox status for a user
   * DEPRECATED: Legacy E2B procedure - replaced by provider-aware getSandbox
   */
  getSandboxStatus: protectedProcedure.query(async ({ ctx }) => {
    // DEPRECATED: This was for E2B sandboxes. Use getSandbox from unified sandbox-manager instead
    return {
      hasActiveSandbox: false,
      sandboxId: null,
      projectId: null,
      fragmentId: null,
      isHealthy: false,
    };
  }),

  /**
   * Kill user's sandbox with proper cleanup
   * DEPRECATED: Legacy E2B procedure
   */
  killSandbox: protectedProcedure.mutation(async ({ ctx }) => {
    // DEPRECATED: This was for E2B sandboxes
    return {
      success: false,
      message: "Deprecated: Use provider-specific sandbox deletion",
      killed: false,
    };
  }),

  /**
   * Update files in current sandbox (hot reload)
   * DEPRECATED: Legacy E2B procedure
   */
  updateSandboxFiles: protectedProcedure
    .input(
      z.object({
        files: z.record(z.string(), z.string()),
        sandboxId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // DEPRECATED: This was for E2B sandboxes
      return {
        success: false,
        message: "Deprecated: Use provider-specific file operations",
        updatedFiles: 0,
      };
    }),

  /**
   * Health check for a project's sandbox (V1 - legacy)
   * DEPRECATED: Legacy E2B procedure - use checkV2ProjectSandboxHealth instead
   */
  checkProjectSandboxHealth: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // DEPRECATED: This was for E2B sandboxes. Use checkV2ProjectSandboxHealth instead
      return {
        hasActiveSandbox: false,
        isProjectSandbox: false,
        isHealthy: false,
        sandboxId: null,
        needsRefresh: true,
      };
    }),

  /**
   * Health check for a V2 project's sandbox using new sandbox manager
   */
  checkV2ProjectSandboxHealth: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get project data with current sandbox info and active fragment
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            sandboxId: true,
            sandboxProvider: true,
            daytonaSandboxId: true, // Legacy Daytona field
            sandboxUrl: true,
            sandboxExpiresAt: true,
            sandboxCreatedAt: true,
            activeFragmentId: true,
            gitRepositoryUrl: true,
            currentBranch: true,
            gitCommitHash: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Determine which sandbox ID to use based on provider
        const provider =
          (project.sandboxProvider as "modal" | "daytona" | null) || "modal";
        const activeSandboxId =
          provider === "modal" ? project.sandboxId : project.daytonaSandboxId;

        // If no sandbox exists, return negative status
        if (!activeSandboxId) {
          return {
            hasActiveSandbox: false,
            isHealthy: false,
            sandboxId: null,
            sandboxUrl: null,
            timeUntilExpiration: null,
            needsRefresh: false,
            needsInitialization: true,
            activeFragmentId: project.activeFragmentId,
            gitRepositoryUrl: project.gitRepositoryUrl,
            currentBranch: project.currentBranch,
            gitCommitHash: project.gitCommitHash,
          };
        }

        // Try to get the sandbox to verify it's running (provider-aware)
        try {
          const sandboxInfo = await getSandbox(input.projectId);

          // If sandboxInfo is null, the sandbox connection failed
          if (!sandboxInfo) {
            // Sandboxes may be temporarily unreachable
            // Since we have a sandboxId in DB but getSandbox() failed,
            // this indicates a temporary connectivity issue or stopped sandbox
            // We should preserve the reference and treat as recoverable
            console.warn(
              `[checkV2ProjectSandboxHealth] Sandbox ${activeSandboxId} (${provider}) temporarily unreachable - preserving reference and marking for recovery`,
            );

            return {
              hasActiveSandbox: true, // We have a sandbox reference
              isHealthy: false,
              sandboxId: activeSandboxId,
              sandboxUrl: project.sandboxUrl, // Keep existing URL for recovery
              timeUntilExpiration: null,
              needsRefresh: true, // This will trigger automatic recovery
              needsInitialization: false, // Not initialization - sandbox exists
              activeFragmentId: project.activeFragmentId,
              gitRepositoryUrl: project.gitRepositoryUrl,
              currentBranch: project.currentBranch,
              gitCommitHash: project.gitCommitHash,
            };
          }

          // Update sandbox URL if it changed (only for Daytona sandboxes)
          // Modal URLs should not be updated here since they're already stored correctly
          if (
            sandboxInfo.sandboxUrl &&
            sandboxInfo.sandboxUrl !== project.sandboxUrl &&
            provider !== "modal" // Don't update Modal URLs
          ) {
            await prisma.project.update({
              where: { id: input.projectId },
              data: {
                sandboxUrl: sandboxInfo.sandboxUrl,
              },
            });
          }

          return {
            hasActiveSandbox: true,
            isHealthy: true,
            sandboxId: activeSandboxId,
            sandboxUrl: sandboxInfo.sandboxUrl || null,
            timeUntilExpiration: null, // Modal and Daytona don't have fixed expiration
            needsRefresh: false,
            needsInitialization: false,
            activeFragmentId: project.activeFragmentId,
            gitRepositoryUrl: project.gitRepositoryUrl,
            currentBranch: project.currentBranch,
            gitCommitHash: project.gitCommitHash,
          };
        } catch (connectError) {
          const errorMessage =
            connectError instanceof Error
              ? connectError.message
              : String(connectError);

          console.warn(
            `[checkV2ProjectSandboxHealth] Sandbox ${activeSandboxId} (${provider}) connection error: ${errorMessage}`,
          );

          // All connection errors should be treated as recoverable since we have a sandbox ID
          return {
            hasActiveSandbox: true,
            isHealthy: false,
            sandboxId: activeSandboxId,
            sandboxUrl: project.sandboxUrl,
            timeUntilExpiration: null,
            needsRefresh: true,
            needsInitialization: false,
            activeFragmentId: project.activeFragmentId,
            gitRepositoryUrl: project.gitRepositoryUrl,
            currentBranch: project.currentBranch,
            gitCommitHash: project.gitCommitHash,
          };
        }
      } catch (error) {
        console.error(`[tRPC checkV2ProjectSandboxHealth] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        return {
          hasActiveSandbox: false,
          isHealthy: false,
          sandboxId: null,
          sandboxUrl: null,
          timeUntilExpiration: null,
          needsRefresh: true,
          needsInitialization: false,
          activeFragmentId: null,
        };
      }
    }),

  /**
   * Restart a stopped V2 project sandbox (lightweight alternative to full recovery)
   */
  restartV2ProjectSandbox: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        console.log(
          `[restartV2ProjectSandbox] Starting restart for project ${input.projectId}`,
        );

        // Check provider - this is a Daytona-only operation
        const provider = await getSandboxProvider(input.projectId);

        if (provider !== "daytona") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Sandbox restart is only supported for Daytona sandboxes. Modal sandboxes are serverless and auto-resume.",
          });
        }

        // Get project data with current sandbox info
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            daytonaSandboxId: true,
            sandboxUrl: true,
            activeFragmentId: true,
            gitRepositoryUrl: true,
            currentBranch: true,
            gitCommitHash: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        if (!project.daytonaSandboxId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No sandbox exists to restart - use recovery instead",
          });
        }

        // Try to start the sandbox
        const startedSandbox = await startSandbox(project.daytonaSandboxId);

        if (!startedSandbox) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start sandbox - it may not exist anymore",
          });
        }

        // Start the development server
        try {
          await startDevServer(startedSandbox, input.projectId);
        } catch (devServerError) {
          console.warn(
            `[restartV2ProjectSandbox] Dev server start failed for project ${input.projectId}:`,
            devServerError,
          );
          // Don't fail the restart if dev server fails - sandbox is still usable
        }

        // Verify the sandbox is now healthy
        const sandboxInfo = await getSandbox(input.projectId);

        if (!sandboxInfo) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Sandbox started but health check failed",
          });
        }

        // Update sandbox URL if it changed
        // Note: We've already verified this is a Daytona sandbox above
        if (
          sandboxInfo.sandboxUrl &&
          sandboxInfo.sandboxUrl !== project.sandboxUrl
        ) {
          await prisma.project.update({
            where: { id: input.projectId },
            data: {
              sandboxUrl: sandboxInfo.sandboxUrl,
            },
          });
        }

        console.log(
          `[restartV2ProjectSandbox] Successfully restarted sandbox for project ${input.projectId}`,
        );

        return {
          success: true,
          sandboxId: sandboxInfo.sandbox.id,
          sandboxUrl: sandboxInfo.sandboxUrl,
          fragmentId: project.activeFragmentId ?? null,
          gitRepositoryUrl: project.gitRepositoryUrl,
          currentBranch: project.currentBranch,
          gitCommitHash: project.gitCommitHash,
          message: "Sandbox restarted successfully",
          isRestart: true,
        };
      } catch (error) {
        console.error(`[restartV2ProjectSandbox] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to restart sandbox",
        });
      }
    }),

  /**
   * Automatically recover/recreate a sandbox when it's unhealthy
   */
  recoverV2ProjectSandbox: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        console.log(
          `[recoverV2ProjectSandbox] Starting recovery for project ${input.projectId}`,
        );

        // Determine which sandbox provider this project uses
        const provider = await getSandboxProvider(input.projectId);
        console.log(
          `[recoverV2ProjectSandbox] Project uses provider: ${provider}`,
        );

        // Note: Daytona sandboxes are persistent and long-living
        // Modal sandboxes are serverless and may auto-suspend
        // Recovery typically means restarting or reconnecting to an existing sandbox

        // Step 1: Quick database check to see if sandbox already exists
        let projectData = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            activeFragmentId: true,
            sandboxId: true,
            daytonaSandboxId: true,
            sandboxUrl: true,
            sandboxProvider: true,
            gitRepositoryUrl: true,
            currentBranch: true,
            gitCommitHash: true,
            importedFrom: true,
            codeImport: { select: { id: true, importedFrom: true } },
          },
        });

        if (!projectData) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Step 2: Check if project already has an active sandbox
        const existingSandboxId =
          provider === "modal"
            ? projectData.sandboxId
            : projectData.daytonaSandboxId;

        if (existingSandboxId) {
          // Verify the sandbox actually exists with the provider
          const sandboxInfo = await getSandbox(input.projectId);

          if (sandboxInfo) {
            console.log(
              `[recoverV2ProjectSandbox] ${provider} sandbox already healthy for project ${input.projectId}`,
            );

            // Ensure build status is READY since sandbox is healthy
            await prisma.project.update({
              where: { id: input.projectId },
              data: {
                buildStatus: "READY",
                buildStatusUpdatedAt: new Date(),
              },
            });

            return {
              success: true,
              sandboxId: sandboxInfo.sandboxId,
              sandboxUrl: sandboxInfo.sandboxUrl,
              fragmentId: projectData.activeFragmentId ?? null,
              gitRepositoryUrl:
                provider === "daytona"
                  ? projectData.gitRepositoryUrl
                  : undefined,
              currentBranch:
                provider === "daytona" ? projectData.currentBranch : undefined,
              gitCommitHash:
                provider === "daytona" ? projectData.gitCommitHash : undefined,
              message: "Sandbox already exists",
              fromCache: true,
            };
          } else {
            // Sandbox exists in DB but not with provider - clear the stale data
            console.log(
              `[recoverV2ProjectSandbox] Sandbox reference exists but sandbox not found. Clearing stale data for project ${input.projectId}`,
            );

            const clearData: any = {
              sandboxUrl: null,
              sandboxCreatedAt: null,
              sandboxExpiresAt: null,
            };

            if (provider === "modal") {
              clearData.sandboxId = null;
            } else {
              clearData.daytonaSandboxId = null;
              clearData.gitRepositoryUrl = null;
              clearData.currentBranch = null;
              clearData.gitCommitHash = null;
            }

            await prisma.project.update({
              where: { id: input.projectId },
              data: clearData,
            });

            // Refresh project data after clearing stale data
            projectData = await prisma.project.findUnique({
              where: { id: input.projectId },
              select: {
                activeFragmentId: true,
                sandboxId: true,
                daytonaSandboxId: true,
                sandboxUrl: true,
                sandboxProvider: true,
                gitRepositoryUrl: true,
                currentBranch: true,
                gitCommitHash: true,
                importedFrom: true,
                codeImport: { select: { id: true, importedFrom: true } },
              },
            });
          }
        }

        console.log(
          `[recoverV2ProjectSandbox] No sandbox found for project ${input.projectId}, creating new ${provider} sandbox with fragment ${projectData?.activeFragmentId}`,
        );

        // Ensure provider is set in database before creating sandbox
        if (!projectData?.sandboxProvider) {
          await setSandboxProvider(input.projectId, provider);
        }

        // Update build status to INITIALIZING before creating sandbox
        await prisma.project.update({
          where: { id: input.projectId },
          data: {
            buildStatus: "INITIALIZING",
            buildStatusUpdatedAt: new Date(),
          },
        });

        // Step 3: Create sandbox OUTSIDE of transaction to prevent timeouts
        // Template for new projects: use "database-vite-template" for Modal, "vite-template-v4" for Daytona
        const templateName =
          provider === "modal" ? "database-vite-template" : "vite-template-v4";
        const isImportedProject = !!projectData?.codeImport;
        const importedFrom =
          projectData?.importedFrom ??
          projectData?.codeImport?.importedFrom ??
          null;
        const newSandboxInfo = await createSandbox(
          input.projectId,
          projectData?.activeFragmentId || null,
          templateName,
          { isImportedProject, importedFrom },
        );

        // Step 4: Update database with new sandbox info (quick transaction)
        const result = await prisma.$transaction(
          async (tx) => {
            // Double-check that another process didn't create a sandbox while we were creating ours
            const currentProject = await tx.project.findUnique({
              where: { id: input.projectId },
              select: {
                sandboxId: true,
                daytonaSandboxId: true,
              },
            });

            const concurrentSandboxId =
              provider === "modal"
                ? currentProject?.sandboxId
                : currentProject?.daytonaSandboxId;

            if (concurrentSandboxId) {
              // Another process created a sandbox, use that one instead
              console.log(
                `[recoverV2ProjectSandbox] Another process created sandbox, using existing one`,
              );
              const existingSandboxInfo = await getSandbox(input.projectId);
              if (existingSandboxInfo) {
                // Update build status to READY since sandbox exists
                await tx.project.update({
                  where: { id: input.projectId },
                  data: {
                    buildStatus: "READY",
                    buildStatusUpdatedAt: new Date(),
                  },
                });

                return {
                  success: true,
                  sandboxId: existingSandboxInfo.sandboxId,
                  sandboxUrl: existingSandboxInfo.sandboxUrl,
                  fragmentId: projectData?.activeFragmentId ?? null,
                  gitRepositoryUrl:
                    provider === "daytona"
                      ? projectData?.gitRepositoryUrl
                      : undefined,
                  currentBranch:
                    provider === "daytona"
                      ? projectData?.currentBranch
                      : undefined,
                  gitCommitHash:
                    provider === "daytona"
                      ? projectData?.gitCommitHash
                      : undefined,
                  message:
                    "Sandbox recovered successfully (concurrent creation)",
                  fromCache: true,
                };
              }
            }

            // Our sandbox creation succeeded, return result
            return {
              success: true,
              sandboxId: newSandboxInfo.sandboxId,
              sandboxUrl: newSandboxInfo.sandboxUrl,
              fragmentId: projectData?.activeFragmentId ?? null,
              gitRepositoryUrl:
                provider === "daytona"
                  ? newSandboxInfo.gitRepositoryUrl
                  : undefined,
              currentBranch:
                provider === "daytona"
                  ? newSandboxInfo.currentBranch
                  : undefined,
              gitCommitHash:
                provider === "daytona"
                  ? newSandboxInfo.gitCommitHash
                  : undefined,
              message: "Sandbox recovered successfully",
              fromCache: false,
            };
          },
          {
            isolationLevel: "Serializable",
            timeout: 30000, // Much shorter timeout for just database operations
          },
        );

        console.log(
          `[recoverV2ProjectSandbox] Successfully recovered sandbox for project ${input.projectId}`,
        );

        // Update build status back to READY after successful sandbox creation
        await prisma.project.update({
          where: { id: input.projectId },
          data: {
            buildStatus: "READY",
            buildStatusUpdatedAt: new Date(),
          },
        });

        // Verify database was updated correctly
        const verifyProject = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            sandboxId: true,
            sandboxUrl: true,
            sandboxCreatedAt: true,
            daytonaSandboxId: true,
          },
        });
        console.log(`[recoverV2ProjectSandbox] Database verification:`, {
          provider,
          sandboxId: verifyProject?.sandboxId,
          daytonaSandboxId: verifyProject?.daytonaSandboxId,
          sandboxUrl: verifyProject?.sandboxUrl,
          sandboxCreatedAt: verifyProject?.sandboxCreatedAt,
        });

        return result;
      } catch (error) {
        console.error(`[recoverV2ProjectSandbox] Error:`, error);

        // Update build status to ERROR on failure
        try {
          await prisma.project.update({
            where: { id: input.projectId },
            data: {
              buildStatus: "ERROR",
              buildStatusUpdatedAt: new Date(),
              buildError:
                error instanceof Error
                  ? error.message
                  : "Failed to recover sandbox",
            },
          });
        } catch (updateError) {
          console.error(
            "[recoverV2ProjectSandbox] Failed to update build status:",
            updateError,
          );
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to recover sandbox",
        });
      }
    }),

  /**
   * Preload a project's latest fragment (for faster switching)
   */
  preloadProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get latest fragment
        const latestMessage = await prisma.message.findFirst({
          where: {
            projectId: input.projectId,
            fragment: { isNot: null },
          },
          include: { fragment: true },
          orderBy: { createdAt: "desc" },
        });

        if (!latestMessage?.fragment) {
          return {
            success: false,
            message: "No fragments found in project",
          };
        }

        // DEPRECATED: This was for E2B sandboxes. Use recoverV2ProjectSandbox instead
        return {
          success: false,
          message: "Deprecated: Use recoverV2ProjectSandbox instead",
          sandboxId: null,
          sandboxUrl: null,
          fragmentId: latestMessage.fragment.id,
        };
      } catch (error) {
        console.error(`[tRPC preloadProject] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to preload project: ${error}`,
        });
      }
    }),

  /**
   * Reinstantiate sandbox with latest project files (for refresh scenarios)
   * DEPRECATED: Legacy E2B procedure - use recoverV2ProjectSandbox instead
   */
  reinstantiateSandbox: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // DEPRECATED: This was for E2B sandboxes. Use recoverV2ProjectSandbox instead
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "Deprecated: Use recoverV2ProjectSandbox instead",
      });
    }),

  /**
   * Check if sandbox should be reinstantiated
   * DEPRECATED: Legacy E2B procedure
   */
  shouldReinstantiateSandbox: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // DEPRECATED: This was for E2B sandboxes
      return {
        shouldReinstantiate: false,
        reason: "Deprecated: E2B sandboxes no longer used",
      };
    }),

  // Debug route to get performance logs
  getPerformanceLogs: protectedProcedure.query(async () => {
    return {
      allLogs: PerformanceLogger.getLogs(),
      slowOperations: PerformanceLogger.getSlowOperations(1000), // Operations > 1s
    };
  }),

  // Debug route to get V2 sandbox operation statistics
  getSandboxOperationLogs: protectedProcedure.query(async () => {
    return {
      // Legacy sandbox operation metrics removed after Daytona migration
      stats: null,
      failedOperations: [],
    };
  }),

  /**
   * Get V2Fragments for a project
   */
  getV2Fragments: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        limit: z.number().optional().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        const fragments = await prisma.v2Fragment.findMany({
          where: {
            projectId: input.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: input.limit,
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            // Snapshot metadata for history UI
            snapshotImageId: true,
            snapshotCreatedAt: true,
            snapshotProvider: true,
            // Don't include files in list view for performance
          },
        });

        return fragments;
      } catch (error) {
        console.error(`[tRPC getV2Fragments] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch V2Fragments",
        });
      }
    }),

  /**
   * Get a specific V2Fragment with files
   */
  getV2Fragment: protectedProcedure
    .input(
      z.object({
        fragmentId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        const fragment = await prisma.v2Fragment.findFirst({
          where: {
            id: input.fragmentId,
            projectId: input.projectId,
          },
        });

        if (!fragment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "V2Fragment not found",
          });
        }

        return fragment;
      } catch (error) {
        console.error(`[tRPC getV2Fragment] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch V2Fragment",
        });
      }
    }),

  /**
   * Load a V2Fragment into the sandbox
   * This will terminate the old sandbox and create a fresh one with the fragment
   */
  loadV2Fragment: protectedProcedure
    .input(
      z.object({
        fragmentId: z.string(),
        projectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get the fragment and project data
        const [fragment, project] = await Promise.all([
          prisma.v2Fragment.findFirst({
            where: {
              id: input.fragmentId,
              projectId: input.projectId,
            },
          }),
          prisma.project.findUnique({
            where: { id: input.projectId },
            select: {
              importedFrom: true,
              codeImport: { select: { importedFrom: true } },
            },
          }),
        ]);

        if (!fragment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "V2Fragment not found",
          });
        }

        // Check if this is an imported project
        const isImportedProject =
          !!project?.importedFrom || !!project?.codeImport;
        const importedFrom =
          project?.importedFrom ?? project?.codeImport?.importedFrom ?? null;

        // Get the existing sandbox (if any)
        const existingSandboxInfo = await getSandbox(input.projectId);

        // Terminate the old sandbox to start fresh
        if (
          existingSandboxInfo?.sandboxId &&
          existingSandboxInfo.provider === "modal"
        ) {
          console.log(
            `[loadV2Fragment] Terminating old sandbox ${existingSandboxInfo.sandboxId} before restoring fragment`,
          );
          try {
            await modalAPI.deleteSandbox(existingSandboxInfo.sandboxId);
            console.log(
              `[loadV2Fragment] Successfully terminated old sandbox ${existingSandboxInfo.sandboxId}`,
            );
          } catch (deleteError) {
            console.warn(
              `[loadV2Fragment] Failed to delete old sandbox, continuing anyway:`,
              deleteError,
            );
          }
        }

        // Create a fresh sandbox with the fragment
        // Note: createSandbox API will automatically update project.sandboxId
        // Template name doesn't matter when fragment has a snapshot (which most do),
        // but use "database-vite-template" to match initial creation for consistency
        console.log(
          `[loadV2Fragment] Creating new Modal sandbox for fragment ${input.fragmentId}`,
        );

        const newSandboxInfo = await modalAPI.createSandbox(
          input.projectId,
          input.fragmentId,
          "database-vite-template",
          { isImportedProject, importedFrom },
        );

        console.log(
          `[loadV2Fragment] Successfully created new sandbox ${newSandboxInfo.sandboxId} with fragment "${fragment.title}"`,
        );

        // Update the project to track the active fragment
        // (sandboxId was already set by createSandbox API)
        await prisma.project.update({
          where: { id: input.projectId },
          data: { activeFragmentId: input.fragmentId },
        });

        return {
          success: true,
          fragment: {
            id: fragment.id,
            title: fragment.title,
            files: fragment.files,
            createdAt: fragment.createdAt,
          },
          sandbox: {
            sandboxId: newSandboxInfo.sandboxId,
            sandboxUrl: newSandboxInfo.sandboxUrl,
          },
          message: `Fragment "${fragment.title}" loaded successfully`,
        };
      } catch (error) {
        console.error(`[tRPC loadV2Fragment] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load V2Fragment",
        });
      }
    }),

  /**
   * Manually load the latest V2Fragment into sandbox for preview
   * This decouples sandbox loading from AI generation
   */
  loadLatestFragmentForPreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get the latest fragment
        const latestFragment = await prisma.v2Fragment.findFirst({
          where: {
            projectId: input.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (!latestFragment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No V2Fragments found for this project",
          });
        }

        // Get or create sandbox
        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "No sandbox exists for this project. Cannot load fragment.",
          });
        }

        // Check provider and use appropriate method
        const provider = await getSandboxProvider(input.projectId);

        if (provider === "modal") {
          console.log(
            `[loadLatestFragmentForPreview] Loading latest fragment "${latestFragment.title}" (${latestFragment.id}) into Modal sandbox ${sandboxInfo.sandboxId}`,
          );

          // Use Modal API to restore fragment
          await modalAPI.restoreV2Fragment(
            sandboxInfo.sandboxId,
            latestFragment.id,
            input.projectId,
          );

          console.log(
            `[loadLatestFragmentForPreview] Successfully loaded latest fragment "${latestFragment.title}" into Modal sandbox for preview`,
          );
        } else {
          // Daytona
          console.log(
            `[loadLatestFragmentForPreview] Loading latest fragment "${latestFragment.title}" (${latestFragment.id}) into Daytona sandbox ${sandboxInfo.sandbox?.id}`,
          );

          if (!sandboxInfo.sandbox) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Daytona sandbox object not available",
            });
          }

          // Restore the latest fragment to sandbox
          await restoreV2FragmentInDaytonaSandbox(
            sandboxInfo.sandbox,
            latestFragment.id,
            input.projectId,
          );

          console.log(
            `[loadLatestFragmentForPreview] Successfully loaded latest fragment "${latestFragment.title}" into Daytona sandbox for preview`,
          );
        }

        // Update the project to track the active fragment
        await prisma.project.update({
          where: { id: input.projectId },
          data: { activeFragmentId: latestFragment.id },
        });

        return {
          success: true,
          message: `Successfully loaded latest fragment "${latestFragment.title}" for preview`,
          fragment: {
            id: latestFragment.id,
            title: latestFragment.title,
            files: latestFragment.files,
            createdAt: latestFragment.createdAt,
          },
          sandbox: {
            sandboxId: sandboxInfo.sandboxId,
            sandboxUrl: sandboxInfo.sandboxUrl,
          },
        };
      } catch (error) {
        console.error(`[tRPC loadLatestFragmentForPreview] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load latest fragment for preview",
        });
      }
    }),

  /**
   * Get project with sandbox information for V2 view
   */
  getProjectWithSandbox: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user has access to this project
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id);

      if (!hasAccess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found or access denied",
        });
      }

      const project = await prisma.project.findUnique({
        where: { id: input.projectId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          sandboxId: true,
          sandboxUrl: true,
          sandboxCreatedAt: true,
          sandboxExpiresAt: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      return project;
    }),

  /**
   * Auto-initialize project with latest fragment and sandbox
   */
  autoInitializeProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get the latest V2Fragment and project data
        const [latestFragment, project] = await Promise.all([
          prisma.v2Fragment.findFirst({
            where: {
              projectId: input.projectId,
            },
            orderBy: {
              createdAt: "desc",
            },
          }),
          prisma.project.findUnique({
            where: { id: input.projectId },
            select: {
              importedFrom: true,
              codeImport: { select: { importedFrom: true } },
            },
          }),
        ]);

        if (!latestFragment) {
          return {
            success: false,
            message: "No fragments found in project",
          };
        }

        // Check if this is an imported project
        const isImportedProject =
          !!project?.importedFrom || !!project?.codeImport;
        const importedFrom =
          project?.importedFrom ?? project?.codeImport?.importedFrom ?? null;

        // Check if project has a provider set, if not set default (Modal)
        const currentProvider = await getSandboxProvider(input.projectId);
        if (!currentProvider) {
          await setSandboxProvider(input.projectId, getDefaultProvider());
        }

        // Get or create sandbox with latest fragment
        // TODO: Route to Modal or Daytona based on provider
        const sandboxInfo =
          (await getSandbox(input.projectId)) ||
          (await createSandbox(input.projectId, latestFragment.id, undefined, {
            isImportedProject,
            importedFrom,
          }));

        // Update the project to track the active fragment
        await prisma.project.update({
          where: { id: input.projectId },
          data: { activeFragmentId: latestFragment.id },
        });

        return {
          success: true,
          fragment: {
            id: latestFragment.id,
            title: latestFragment.title,
            files: latestFragment.files,
          },
          sandbox: {
            sandboxId: sandboxInfo.sandbox.id,
            sandboxUrl: sandboxInfo.sandboxUrl,
          },
          message: "Project initialized successfully",
        };
      } catch (error) {
        console.error(`[tRPC autoInitializeProject] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to auto-initialize project",
        });
      }
    }),

  /**
   * Get all files from the sandbox with their content
   */
  getAllSandboxFiles: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get sandbox files via Daytona manager
        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sandbox not found",
          });
        }

        console.log(
          `[getAllSandboxFiles] Retrieved ${sandboxInfo.files.size} files for project ${input.projectId}`,
        );

        // Convert Map to Set of file paths
        return new Set(sandboxInfo.files.keys());
      } catch (error) {
        console.error(`[getAllSandboxFiles] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get sandbox files",
        });
      }
    }),

  /**
   * Get all files from the sandbox with their actual content
   */
  getAllSandboxFilesWithContent: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get sandbox files
        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sandbox not found",
          });
        }

        console.log(
          `[getAllSandboxFilesWithContent] Reading content for ${sandboxInfo.files.size} files for project ${input.projectId}`,
        );

        // Read file contents
        const filesWithContent: { [path: string]: string } = {};
        const filePaths = Array.from(sandboxInfo.files.keys());

        // Read files in parallel but limit concurrency to avoid overwhelming the sandbox
        const batchSize = 10;
        for (let i = 0; i < filePaths.length; i += batchSize) {
          const batch = filePaths.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (filePath) => {
              try {
                // Strip workspace prefix if present for Modal
                let modalPath = filePath;
                if (modalPath.startsWith("/home/daytona/workspace/")) {
                  modalPath = modalPath.replace("/home/daytona/workspace/", "");
                } else if (modalPath.startsWith("workspace/")) {
                  modalPath = modalPath.replace("workspace/", "");
                }

                const content = await modalAPI.readFile(
                  sandboxInfo.sandboxId,
                  modalPath,
                );
                filesWithContent[filePath] = content;
              } catch (err) {
                console.warn(
                  `[getAllSandboxFilesWithContent] Failed to read ${filePath}:`,
                  err,
                );
                filesWithContent[filePath] = ""; // Empty content for failed reads
              }
            }),
          );
        }

        console.log(
          `[getAllSandboxFilesWithContent] Successfully read ${
            Object.keys(filesWithContent).length
          } files`,
        );

        return filesWithContent;
      } catch (error) {
        console.error(`[getAllSandboxFilesWithContent] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get sandbox files with content",
        });
      }
    }),

  /**
   * Get content of a specific file from the sandbox
   */
  getSandboxFileContent: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        filePath: z.string().min(1, { message: "File path is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get sandbox info via unified manager
        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sandbox not found",
          });
        }

        // Check if file exists - handle both relative and absolute paths
        let resolvedFilePath = input.filePath;
        if (!sandboxInfo.files.has(input.filePath)) {
          // Try absolute path format (what's actually stored in sandboxInfo.files)
          const absolutePath = `/home/daytona/workspace/${input.filePath}`;
          if (sandboxInfo.files.has(absolutePath)) {
            resolvedFilePath = absolutePath;
          } else {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "File not found in sandbox",
            });
          }
        }

        // Read file content based on provider
        try {
          // Use Modal API to read file
          // Modal uses relative paths (no /home/daytona/workspace prefix)
          let modalPath = resolvedFilePath;
          if (modalPath.startsWith("/home/daytona/workspace/")) {
            modalPath = modalPath.replace("/home/daytona/workspace/", "");
          } else if (modalPath.startsWith("workspace/")) {
            modalPath = modalPath.replace("workspace/", "");
          }

          const content = await modalAPI.readFile(
            sandboxInfo.sandboxId,
            modalPath,
          );

          return { content, filePath: input.filePath };
        } catch (error) {
          console.warn(
            `[getSandboxFileContent] Failed to read ${input.filePath}:`,
            error,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to read file: ${input.filePath}`,
          });
        }
      } catch (error) {
        console.error(`[getSandboxFileContent] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get sandbox file content",
        });
      }
    }),

  /**
   * Get authenticated preview URL for a sandbox
   */
  getAuthenticatedPreviewUrl: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        port: z.number().optional().default(5173),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Check provider
        const provider = await getSandboxProvider(input.projectId);

        // Skip URL transformation if NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM is set
        // This is for staging/preview environments where shipper.now proxy won't work
        // Using NEXT_PUBLIC_ prefix so monitoring script can also access it for origin checks
        const skipTransform =
          process.env.NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM === "true";

        if (provider === "modal") {
          // Modal sandboxes don't use authentication tokens

          if (skipTransform) {
            // For staging/preview environments, fetch the original Modal URL from the database
            // without transformation (the shipper.now proxy won't work on preview URLs)
            const project = await prisma.project.findUnique({
              where: { id: input.projectId },
              select: { sandboxUrl: true },
            });

            if (!project || !project.sandboxUrl) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message:
                  "Sandbox URL not available. The dev server may not be running yet.",
              });
            }

            console.log(
              `[getAuthenticatedPreviewUrl] NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM enabled - using original Modal URL for project ${input.projectId}`,
              `Original URL: ${project.sandboxUrl}`,
            );

            // Return the original Modal tunnel URL without transformation
            return {
              url: project.sandboxUrl,
              authenticatedUrl: project.sandboxUrl,
              token: undefined, // Modal doesn't use tokens
            };
          }

          // Normal flow: return transformed URL from getSandbox
          const sandboxInfo = await getSandbox(input.projectId);

          if (!sandboxInfo || !sandboxInfo.sandboxUrl) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message:
                "Sandbox URL not available. The dev server may not be running yet.",
            });
          }

          console.log(
            `[getAuthenticatedPreviewUrl] Got Modal preview URL for project ${input.projectId}`,
          );

          // Transform URL for display purposes (AI tools and "Open in new tab" button)
          // The iframe will use originalUrl (direct Modal URL)
          const transformedUrl = transformModalUrlForDisplay(
            sandboxInfo.sandboxUrl,
            input.projectId,
            {
              NODE_ENV: process.env.NODE_ENV,
              NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM:
                process.env.NEXT_PUBLIC_SKIP_MODAL_URL_TRANSFORM,
              NEXT_PUBLIC_MODAL_USE_LOCALHOST:
                process.env.NEXT_PUBLIC_MODAL_USE_LOCALHOST,
            },
          );

          console.log(
            `[getAuthenticatedPreviewUrl] Transformed URL for display`,
            {
              original: sandboxInfo.sandboxUrl,
              transformed: transformedUrl,
            },
          );

          // Return both original Modal URL (for iframe) and transformed URL (for AI tools and external link)
          return {
            url: transformedUrl, // Transformed shipper.now proxy URL (for AI tools)
            authenticatedUrl: transformedUrl, // Transformed URL (for external link button)
            originalUrl: sandboxInfo.originalSandboxUrl, // Original Modal URL (for iframe)
            token: undefined, // Modal doesn't use tokens
          };
        } else {
          // Daytona sandboxes use authentication tokens
          const authInfo = await getPreviewAuthForSession(
            input.projectId,
            input.port,
          );

          console.log(
            `[getAuthenticatedPreviewUrl] Got authenticated preview URL for project ${input.projectId}, port ${input.port}`,
          );

          return {
            url: authInfo.url,
            authenticatedUrl: authInfo.authenticatedUrl,
            token: authInfo.token,
          };
        }
      } catch (error) {
        console.error(`[getAuthenticatedPreviewUrl] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get authenticated preview URL",
        });
      }
    }),

  /**
   * Get Git fragments for a project (V3 fragment system)
   */
  getGitFragments: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        const gitFragments = await prisma.gitFragment.findMany({
          where: {
            projectId: input.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: input.limit,
        });

        return gitFragments.map((fragment) => ({
          id: fragment.id,
          title: fragment.title,
          commitHash: fragment.commitHash,
          branch: fragment.branch,
          message: fragment.message,
          authorEmail: fragment.authorEmail,
          authorName: fragment.authorName,
          createdAt: fragment.createdAt,
        }));
      } catch (error) {
        console.error(`[getGitFragments] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get git fragments",
        });
      }
    }),

  /**
   * Switch to a specific git commit (V3 fragment switching)
   */
  switchToGitCommit: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        commitHash: z.string().min(1, { message: "Commit hash is required" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
          ["OWNER", "ADMIN", "MEMBER"], // Viewers can't switch fragments
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Check if project supports Git operations (Daytona only)
        const provider = await getSandboxProvider(input.projectId);
        if (!supportsFeature(provider, "git")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Git operations are not supported for ${provider} sandboxes. This feature is only available for Daytona projects.`,
          });
        }

        // Verify the git fragment exists
        const gitFragment = await prisma.gitFragment.findFirst({
          where: {
            projectId: input.projectId,
            commitHash: input.commitHash,
          },
        });

        if (!gitFragment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Git fragment not found",
          });
        }

        // Get or create sandbox
        let sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          sandboxInfo = await createSandbox(input.projectId);
        }

        // Switch to the git commit
        await switchToGitCommit(
          sandboxInfo.sandbox,
          input.projectId,
          input.commitHash,
        );

        return {
          success: true,
          message: `Successfully switched to commit ${input.commitHash.substring(
            0,
            8,
          )}`,
          commitHash: input.commitHash,
          fragmentTitle: gitFragment.title,
          sandboxId: sandboxInfo.sandbox.id,
          sandboxUrl: sandboxInfo.sandboxUrl,
        };
      } catch (error) {
        console.error(`[switchToGitCommit] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to switch to git commit",
        });
      }
    }),

  /**
   * Check if a deployment exists for a project
   */
  getProjectDeployment: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Find the most recent deployment for this project
        const deployment = await prisma.deployment.findFirst({
          where: {
            projectId: input.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            appId: true,
            name: true,
            url: true,
            createdAt: true,
            updatedAt: true,
            lastAccessed: true,
          },
        });

        return {
          exists: !!deployment,
          deployment: deployment || null,
        };
      } catch (error) {
        console.error(`[getProjectDeployment] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check project deployment",
        });
      }
    }),

  deployApp: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        appName: z.string().optional(),
        subdomain: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(
          `[deployApp] Starting deployment for project ${input.projectId}`,
        );

        // Check if user has access to this project
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this project",
          });
        }

        // Get project info to determine app name
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            name: true,
            deploymentUrl: true, // Check if already deployed
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Use subdomain if provided, otherwise fall back to appName or project name
        console.log("[deployApp] input.subdomain:", input.subdomain);
        console.log("[deployApp] input.appName:", input.appName);
        console.log("[deployApp] project.name:", project.name);

        // Use subdomain if it's a non-empty string, otherwise fall back
        let appName =
          (input.subdomain && input.subdomain.trim()) ||
          input.appName ||
          project.name;
        console.log(
          "[deployApp] Selected appName before sanitization:",
          appName,
        );

        // Sanitize appName to ensure it's a valid subdomain
        appName = appName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .replace(/^-+/, "")
          .replace(/-+$/, "");

        console.log("[deployApp] Final appName after sanitization:", appName);

        // Check if app name already exists in deployments (unless it's an update to the same project)
        if (!project.deploymentUrl) {
          // Only check for new deployments, not updates
          const existingDeployment = await prisma.deployment.findFirst({
            where: {
              OR: [{ appId: appName }, { name: appName }],
              // Exclude deployments from the same project (in case of re-deployment)
              projectId: { not: input.projectId },
            },
          });

          if (existingDeployment) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `App name "${appName}" is already taken. Please choose a different name or rename your project.`,
            });
          }
        }

        // Get sandbox info
        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "No sandbox found for this project. Please create your app first.",
          });
        }

        // Deploy the sandbox app - route based on provider
        let deploymentResult;
        const provider = await getSandboxProvider(input.projectId);

        if (provider === "modal") {
          // Use Modal API for deployment
          deploymentResult = await modalAPI.deploySandbox(
            sandboxInfo.sandboxId,
            input.projectId,
            appName, // Use the sanitized appName (which includes subdomain)
          );
        } else {
          // Use Daytona for deployment
          if (!sandboxInfo.sandbox) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Daytona sandbox instance not available",
            });
          }
          deploymentResult = await deploySandboxApp(
            sandboxInfo.sandbox,
            input.projectId,
            appName, // Use the sanitized appName (which includes subdomain)
          );
        }

        if (deploymentResult.success) {
          console.log(
            `[deployApp] Deployment successful for project ${input.projectId}`,
          );

          // Persist deployment metadata to both the project record and deployment table
          try {
            const deployedRefToStore =
              // If the deploymentResult includes a commit/hash prefer that
              (deploymentResult as any).commitHash ||
              // Otherwise use the project's current gitCommitHash if present
              undefined;

            // Update project record for quick access
            await prisma.project.update({
              where: { id: input.projectId },
              data: {
                deploymentUrl: deploymentResult.deploymentUrl || undefined,
                deployedAt: new Date(),
                deployedRef: deployedRefToStore || undefined,
              },
            });

            // Create or update deployment record in the deployments table
            await prisma.deployment.upsert({
              where: {
                projectId: input.projectId,
              },
              create: {
                appId: appName,
                name: appName,
                url: deploymentResult.deploymentUrl || "",
                files: [], // Will be populated by the deployment system
                projectId: input.projectId,
                userId: ctx.user.id,
                entryPoint: "index.html",
              },
              update: {
                url: deploymentResult.deploymentUrl || "",
                updatedAt: new Date(),
                lastAccessed: new Date(),
                userId: ctx.user.id, // Ensure userId is always set, even on re-deployment
              },
            });
          } catch (e) {
            console.warn(
              "[deployApp] Failed to persist deployment metadata:",
              e,
            );
          }

          // After successful app deployment, trigger Convex production deploy if enabled
          // This is fire-and-forget - we don't block the deployment response on it
          (async () => {
            try {
              // Check if the project has a ConvexDeployment record
              const convexDeployment = await prisma.convexDeployment.findUnique(
                {
                  where: { projectId: input.projectId },
                  select: { id: true },
                },
              );

              if (!convexDeployment) {
                console.log(
                  "[deployApp] No Convex deployment found - skipping Convex production deploy",
                );
                return;
              }

              console.log("[deployApp] Triggering Convex production deploy...");

              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
              const apiKey = process.env.SHIPPER_API_KEY;

              if (!apiKey) {
                console.warn(
                  "[deployApp] SHIPPER_API_KEY not set - cannot deploy Convex",
                );
                return;
              }

              const resp = await fetch(`${apiUrl}/api/v1/convex/deploy`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": apiKey,
                },
                body: JSON.stringify({
                  projectId: input.projectId,
                  environment: "production",
                }),
              });

              const data = await resp.json();
              if (data.success) {
                console.log("[deployApp] Convex production deploy succeeded");
              } else {
                console.warn(
                  "[deployApp] Convex production deploy failed:",
                  data.error,
                );
              }
            } catch (err) {
              console.warn("[deployApp] Convex production deploy error:", err);
            }
          })();

          return {
            success: true,
            message: "App deployed successfully!",
            deploymentUrl: deploymentResult.deploymentUrl,
            logs: deploymentResult.logs,
          };
        } else {
          console.error(
            `[deployApp] Deployment failed for project ${input.projectId}:`,
            deploymentResult.error,
          );

          // Return failure with clean message and filtered logs
          return {
            success: false,
            message: "Deployment failed", // Simple clean message
            error: deploymentResult.error,
            logs: deploymentResult.logs, // Already filtered by sandbox manager
            buildFailed: true,
          };
        }
      } catch (error) {
        console.error(`[deployApp] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to deploy app",
        });
      }
    }),

  /**
   * Export project files to ZIP
   */
  exportToZip: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        filePaths: z
          .array(z.string())
          .min(1, "At least one file path is required"), // Required: use pre-fetched file list
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(
          `[exportToZip] Starting export for project ${input.projectId}`,
        );

        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );

        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project details
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            name: true,
            daytonaSandboxId: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Get sandbox
        const sandboxInfo = await getSandbox(input.projectId);

        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Sandbox not found. Please ensure your project is running.",
          });
        }

        // Require file paths - no legacy fallback
        if (!input.filePaths || input.filePaths.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File paths are required for export",
          });
        }

        // Use optimized export with pre-filtered file list
        // Pass the full sandboxInfo with provider type for proper routing
        const { exportSandboxFilesToZip } = await import("@/lib/export-utils");
        const { buffer, filename } = await exportSandboxFilesToZip(
          {
            sandboxId: sandboxInfo.sandboxId,
            sandbox: sandboxInfo.sandbox, // Only present for Daytona
            provider: sandboxInfo.provider,
          },
          project.name,
          input.filePaths,
        );

        // Convert buffer to base64 for transmission
        const base64 = buffer.toString("base64");

        console.log(
          `[exportToZip] Successfully exported project ${input.projectId} to ${filename} (${input.filePaths?.length || "all"} files)`,
        );

        return {
          success: true,
          filename,
          data: base64,
        };
      } catch (error) {
        console.error(`[exportToZip] Error:`, error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to export project to ZIP",
        });
      }
    }),

  /**
   * Get GitHub connection status for project
   */
  getGithubConnectionStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get user's GitHub token
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: {
            githubAccessToken: true,
            githubUsername: true,
          },
        });

        // Get project's GitHub connection
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            githubRepositoryUrl: true,
            githubRepoOwner: true,
            githubRepoName: true,
            githubBranch: true,
            lastGithubSyncAt: true,
            githubConnectionStatus: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        return {
          hasGithubAuth: !!user?.githubAccessToken,
          githubUsername: user?.githubUsername,
          isConnected: !!project.githubRepoOwner && !!project.githubRepoName,
          repositoryUrl: project.githubRepositoryUrl,
          repoOwner: project.githubRepoOwner,
          repoName: project.githubRepoName,
          branch: project.githubBranch || "main",
          lastSyncAt: project.lastGithubSyncAt,
          status: project.githubConnectionStatus,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get GitHub connection status",
        });
      }
    }),

  /**
   * List user's GitHub repositories
   */
  listGithubRepos: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        perPage: z.number().default(30),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        // Get user's GitHub token
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { githubAccessToken: true },
        });

        if (!user?.githubAccessToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "GitHub not connected. Please sign in with GitHub.",
          });
        }

        // Fetch repositories
        const github = new GitHubService(user.githubAccessToken);
        const result = await github.listRepositories(input.page, input.perPage);

        return result;
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to list GitHub repositories",
        });
      }
    }),

  /**
   * Create a new GitHub repository
   */
  createGithubRepo: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Repository name is required"),
        description: z.string().optional(),
        private: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Get user's GitHub token
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { githubAccessToken: true, githubUsername: true },
        });

        if (!user?.githubAccessToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "GitHub not connected. Please sign in with GitHub.",
          });
        }

        // Create repository
        const github = new GitHubService(user.githubAccessToken);
        const repo = await github.createRepository(
          input.name,
          input.private,
          input.description,
        );

        console.log(`[createGithubRepo] Created repository: ${repo.fullName}`);

        return {
          success: true,
          owner: repo.owner,
          name: repo.name,
          fullName: repo.fullName,
          url: repo.url,
          defaultBranch: repo.defaultBranch || "main",
        };
      } catch (error: any) {
        console.error("[createGithubRepo] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create GitHub repository",
        });
      }
    }),

  /**
   * Connect project to GitHub repository
   */
  connectGithubRepo: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        repoOwner: z.string(),
        repoName: z.string(),
        branch: z.string().optional(), // Optional - will use repo's default branch if not provided
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get user's GitHub token
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { githubAccessToken: true },
        });

        if (!user?.githubAccessToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "GitHub not connected. Please sign in with GitHub.",
          });
        }

        // Verify repository exists and user has access
        const github = new GitHubService(user.githubAccessToken);
        const repo = await github.getRepository(
          input.repoOwner,
          input.repoName,
        );

        if (!repo.exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Repository ${input.repoOwner}/${input.repoName} not found`,
          });
        }

        // Check write access
        const hasWriteAccess = await github.hasWriteAccess(
          input.repoOwner,
          input.repoName,
        );

        if (!hasWriteAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have write access to this repository",
          });
        }

        // Update project with GitHub connection
        // Use the repo's actual default branch if no branch specified
        const branchToUse = input.branch || repo.defaultBranch || "main";

        const updatedProject = await prisma.project.update({
          where: { id: input.projectId },
          data: {
            githubRepositoryUrl: repo.url,
            githubRepoOwner: input.repoOwner,
            githubRepoName: input.repoName,
            githubBranch: branchToUse,
            githubConnectionStatus: "connected",
          },
        });

        return {
          success: true,
          repositoryUrl: updatedProject.githubRepositoryUrl,
          repoOwner: updatedProject.githubRepoOwner,
          repoName: updatedProject.githubRepoName,
          branch: updatedProject.githubBranch,
        };
      } catch (error: any) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to connect GitHub repository",
        });
      }
    }),

  /**
   * Push project files to GitHub
   */
  pushToGithub: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        commitMessage: z.string().optional(),
        filePaths: z
          .array(z.string())
          .min(1, "At least one file path is required"), // Required: use pre-fetched file list
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(
          `[pushToGithub] Starting push for project ${input.projectId}`,
        );

        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get user's GitHub token
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { githubAccessToken: true },
        });

        if (!user?.githubAccessToken) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "GitHub not connected. Please sign in with GitHub.",
          });
        }

        // Get project with GitHub connection
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            name: true,
            githubRepoOwner: true,
            githubRepoName: true,
            githubBranch: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        if (!project.githubRepoOwner || !project.githubRepoName) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project not connected to GitHub repository",
          });
        }

        // Get sandbox
        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:
              "Sandbox not found. Please ensure your project is running.",
          });
        }

        // Require file paths - no legacy fallback
        if (!input.filePaths || input.filePaths.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "File paths are required for GitHub push",
          });
        }

        // Download files using provider-aware method with pre-filtered file list
        console.log(
          `[pushToGithub] Downloading files from ${sandboxInfo.provider} sandbox...`,
        );
        const { downloadModalFiles, downloadDaytonaFiles } = await import(
          "@/lib/export-utils"
        );

        let files: Record<string, string>;
        if (sandboxInfo.provider === "modal") {
          files = await downloadModalFiles(
            sandboxInfo.sandboxId,
            input.filePaths,
          );
        } else if (sandboxInfo.provider === "daytona") {
          if (!sandboxInfo.sandbox) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Daytona sandbox instance is required",
            });
          }
          files = await downloadDaytonaFiles(
            sandboxInfo.sandbox,
            input.filePaths,
          );
        } else {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Unsupported sandbox provider: ${sandboxInfo.provider}`,
          });
        }

        const fileCount = Object.keys(files).length;
        console.log(
          `[pushToGithub] Downloaded ${fileCount} files from provided list of ${input.filePaths.length}`,
        );

        if (fileCount === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No files found to push",
          });
        }

        // Generate comprehensive README.md
        console.log("[pushToGithub] Generating README.md...");
        const { generateReadme } = await import("@/lib/readme-generator");
        const readmeContent = generateReadme(project.name, files);

        // Add or replace README.md
        files["README.md"] = readmeContent;
        console.log("[pushToGithub] README.md generated and added to files");

        // Push to GitHub
        const github = new GitHubService(user.githubAccessToken);
        const commitMsg = input.commitMessage || "Update from Shipper";

        console.log("[pushToGithub] Pushing files to GitHub...");
        const pushResult = await github.pushFiles(
          project.githubRepoOwner,
          project.githubRepoName,
          project.githubBranch || "main",
          files,
          commitMsg,
        );

        // Update project sync time
        await prisma.project.update({
          where: { id: input.projectId },
          data: {
            lastGithubSyncAt: new Date(),
            githubConnectionStatus: "connected",
          },
        });

        console.log(
          `[pushToGithub] Successfully pushed ${pushResult.filesProcessed} files`,
        );

        return {
          success: true,
          commitSha: pushResult.commitSha,
          commitUrl: pushResult.commitUrl,
          filesProcessed: pushResult.filesProcessed,
          message: `Successfully pushed ${pushResult.filesProcessed} files to GitHub`,
        };
      } catch (error: any) {
        console.error("[pushToGithub] Error:", error);

        // Update connection status on error
        try {
          await prisma.project.update({
            where: { id: input.projectId },
            data: { githubConnectionStatus: "error" },
          });
        } catch {}

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to push to GitHub",
        });
      }
    }),

  /**
   * Disconnect GitHub account (logout)
   */
  disconnectGithubAccount: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Remove GitHub access token and username from user
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          githubAccessToken: null,
          githubUsername: null,
        },
      });

      console.log(
        `[disconnectGithubAccount] User ${ctx.user.id} disconnected GitHub account`,
      );

      return {
        success: true,
        message: "GitHub account disconnected successfully",
      };
    } catch (error) {
      console.error("[disconnectGithubAccount] Error:", error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to disconnect GitHub account",
      });
    }
  }),

  /**
   * Disconnect project from GitHub repository
   */
  disconnectGithubRepo: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Remove GitHub connection
        await prisma.project.update({
          where: { id: input.projectId },
          data: {
            githubRepositoryUrl: null,
            githubRepoOwner: null,
            githubRepoName: null,
            githubBranch: null,
            lastGithubSyncAt: null,
            githubConnectionStatus: "disconnected",
          },
        });

        return {
          success: true,
          message: "GitHub repository disconnected",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to disconnect GitHub repository",
        });
      }
    }),

  /**
   * Get publish metadata from index.html in sandbox
   */
  getPublishMetadata: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project to find sandbox
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            sandboxId: true,
            daytonaSandboxId: true,
            sandboxProvider: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        const provider =
          (project.sandboxProvider as "modal" | "daytona" | null) || "modal";
        const sandboxId =
          provider === "modal" ? project.sandboxId : project.daytonaSandboxId;

        if (!sandboxId) {
          return {
            title: "",
            icon: "",
            description: "",
          };
        }

        // Read index.html from sandbox
        const { daytonaAPI } = await import("@/lib/api/daytona-client");
        const { modalAPI } = await import("@/lib/api/modal-client");

        const api = provider === "modal" ? modalAPI : daytonaAPI;

        let htmlContent = "";
        try {
          htmlContent = await api.readFile(sandboxId, "index.html");
        } catch (error) {
          console.error(
            "[getPublishMetadata] Failed to read index.html:",
            error,
          );
          return {
            title: "",
            icon: "",
            description: "",
          };
        }

        // Parse metadata from HTML
        const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/);
        const iconMatch = htmlContent.match(
          /<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["']/,
        );
        const descriptionMatch = htmlContent.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/,
        );
        const ogImageMatch = htmlContent.match(
          /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/,
        );

        // If icon path exists, try to read it from sandbox using the API
        let iconDataUrl = "";
        if (iconMatch && iconMatch[1]) {
          const iconPath = iconMatch[1].replace(/^\//, ""); // Remove leading slash
          if (iconPath && iconPath.startsWith("favicon.")) {
            try {
              const result = await api.getMetadataImage(
                input.projectId,
                "icon",
              );
              iconDataUrl = result.dataUrl;
            } catch (error) {
              console.warn(
                "[getPublishMetadata] Failed to read icon from sandbox:",
                error,
              );
            }
          }
        }

        // If share image path exists, try to read it from sandbox using the API
        let shareImageDataUrl = "";
        if (ogImageMatch && ogImageMatch[1]) {
          const imagePath = ogImageMatch[1].replace(/^\//, ""); // Remove leading slash
          if (imagePath && imagePath.startsWith("images/")) {
            try {
              const result = await api.getMetadataImage(
                input.projectId,
                "shareImage",
              );
              shareImageDataUrl = result.dataUrl;
              console.log(shareImageDataUrl, "shareImageDataUrl");
            } catch (error) {
              console.warn(
                "[getPublishMetadata] Failed to read share image from sandbox:",
                error,
              );
            }
          }
        }

        return {
          title: titleMatch ? titleMatch[1] : "",
          icon: iconDataUrl || (iconMatch ? iconMatch[1] : ""),
          description: descriptionMatch ? descriptionMatch[1] : "",
          shareImage:
            shareImageDataUrl || (ogImageMatch ? ogImageMatch[1] : ""),
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get publish metadata",
        });
      }
    }),

  /**
   * Get Turso database information for a project
   */
  getTursoDatabaseInfo: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Check if project has a Turso database
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { tursoDatabaseName: true },
        });

        if (!project?.tursoDatabaseName) {
          return {
            hasDatabase: false,
            info: null,
          };
        }

        // Fetch database info from Turso API
        const databaseInfo = await getDatabaseInfo(input.projectId);

        return {
          hasDatabase: true,
          info: databaseInfo,
        };
      } catch (error) {
        console.error("[getTursoDatabaseInfo] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve database information",
        });
      }
    }),

  /**
   * Check if a subdomain is available
   */
  checkSubdomainAvailability: protectedProcedure
    .input(
      z.object({
        subdomain: z.string(),
        projectId: z.string().optional(), // Exclude this project from the check
      }),
    )
    .query(async ({ input }) => {
      try {
        console.log("[checkSubdomainAvailability] Input:", input);

        // Sanitize subdomain to match how it will be stored
        const sanitizedSubdomain = input.subdomain
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "")
          .replace(/^-+/, "")
          .replace(/-+$/, "");

        console.log(
          "[checkSubdomainAvailability] Sanitized subdomain:",
          sanitizedSubdomain,
        );

        // First, let's see ALL deployments to debug
        const allDeployments = await prisma.deployment.findMany({
          select: {
            appId: true,
            name: true,
            projectId: true,
          },
        });
        console.log(
          "[checkSubdomainAvailability] All deployments in DB:",
          allDeployments,
        );

        // Check if subdomain is already taken by another deployment
        const existingDeployment = await prisma.deployment.findFirst({
          where: {
            name: sanitizedSubdomain,
            ...(input.projectId && { projectId: { not: input.projectId } }),
          },
        });

        console.log(
          "[checkSubdomainAvailability] Existing deployment found:",
          existingDeployment,
        );
        console.log(
          "[checkSubdomainAvailability] Available:",
          !existingDeployment,
        );

        return {
          available: !existingDeployment,
          subdomain: sanitizedSubdomain,
        };
      } catch (error) {
        console.error("[checkSubdomainAvailability] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check subdomain availability",
        });
      }
    }),

  /**
   * Update publish metadata in index.html
   */
  updatePublishMetadata: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().optional(),
        icon: z.string().optional(),
        description: z.string().optional(),
        shareImage: z.string().optional(), // Base64 data URL (data:image/...;base64,...)
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Helper to escape HTML attribute values
      const escapeHtml = (text: string) => {
        return text
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      };

      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project to find sandbox
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            sandboxId: true,
            daytonaSandboxId: true,
            sandboxProvider: true,
            activeFragmentId: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        const provider =
          (project.sandboxProvider as "modal" | "daytona" | null) || "modal";
        const sandboxId =
          provider === "modal" ? project.sandboxId : project.daytonaSandboxId;

        if (!sandboxId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active sandbox found",
          });
        }

        // Read current index.html
        const { daytonaAPI } = await import("@/lib/api/daytona-client");
        const { modalAPI } = await import("@/lib/api/modal-client");

        const api = provider === "modal" ? modalAPI : daytonaAPI;

        let htmlContent = await api.readFile(sandboxId, "index.html");

        // Update title
        if (input.title !== undefined) {
          const escapedTitle = escapeHtml(input.title);
          if (htmlContent.includes("<title>")) {
            htmlContent = htmlContent.replace(
              /<title>.*?<\/title>/,
              `<title>${escapedTitle}</title>`,
            );
          } else {
            // Add title if it doesn't exist
            htmlContent = htmlContent.replace(
              /<\/head>/,
              `  <title>${escapedTitle}</title>\n  </head>`,
            );
          }
        }

        // Update icon
        if (input.icon !== undefined) {
          let iconPath = input.icon;

          // Check if it's a base64 data URL (uploaded file)
          if (input.icon.startsWith("data:image/")) {
            try {
              const base64Match = input.icon.match(
                /^data:image\/(\w+);base64,(.+)$/,
              );
              if (!base64Match) {
                throw new Error("Invalid icon format");
              }

              const [, imageType, base64Data] = base64Match;

              // Upload icon using dedicated metadata endpoint
              let result;
              if (provider === "daytona") {
                const { daytonaAPI } = await import("@/lib/api/daytona-client");
                result = await daytonaAPI.uploadMetadataImage(
                  input.projectId,
                  "icon",
                  base64Data,
                  imageType,
                );
              } else {
                result = await modalAPI.uploadMetadataImage(
                  input.projectId,
                  "icon",
                  base64Data,
                  imageType,
                );
              }

              iconPath = result.url;
            } catch (error) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message:
                  error instanceof Error
                    ? error.message
                    : "Failed to upload icon",
              });
            }
          }

          if (htmlContent.match(/<link[^>]*rel=["']icon["']/)) {
            htmlContent = htmlContent.replace(
              /<link[^>]*rel=["']icon["'][^>]*>/,
              `<link rel="icon" href="${iconPath}" />`,
            );
          } else {
            // Add icon if it doesn't exist
            htmlContent = htmlContent.replace(
              /<\/head>/,
              `  <link rel="icon" href="${iconPath}" />\n  </head>`,
            );
          }
        }

        // Update description
        if (input.description !== undefined) {
          const escapedDescription = escapeHtml(input.description);
          if (htmlContent.match(/<meta[^>]*name=["']description["']/)) {
            htmlContent = htmlContent.replace(
              /<meta[^>]*name=["']description["'][^>]*>/,
              `<meta name="description" content="${escapedDescription}" />`,
            );
          } else {
            // Add description if it doesn't exist
            htmlContent = htmlContent.replace(
              /<\/head>/,
              `  <meta name="description" content="${escapedDescription}" />\n  </head>`,
            );
          }
        }

        // Handle share image upload
        let shareImageUrl: string | undefined;
        if (input.shareImage) {
          try {
            // Parse base64 data URL
            const base64Match = input.shareImage.match(
              /^data:image\/(\w+);base64,(.+)$/,
            );
            if (!base64Match) {
              throw new Error("Invalid image format");
            }

            const [, imageType, base64Data] = base64Match;

            // Upload share image using dedicated metadata endpoint
            let result;
            if (provider === "daytona") {
              const { daytonaAPI } = await import("@/lib/api/daytona-client");
              result = await daytonaAPI.uploadMetadataImage(
                input.projectId,
                "shareImage",
                base64Data,
                imageType,
              );
            } else {
              result = await modalAPI.uploadMetadataImage(
                input.projectId,
                "shareImage",
                base64Data,
                imageType,
              );
            }

            shareImageUrl = result.url;
          } catch (error) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                error instanceof Error
                  ? error.message
                  : "Failed to upload share image",
            });
          }
        }

        // Update or add Open Graph image meta tag
        if (shareImageUrl !== undefined) {
          const ogImageTag = `<meta property="og:image" content="${shareImageUrl}" />`;

          if (htmlContent.match(/<meta[^>]*property=["']og:image["']/)) {
            htmlContent = htmlContent.replace(
              /<meta[^>]*property=["']og:image["'][^>]*>/,
              ogImageTag,
            );
          } else {
            // Add og:image if it doesn't exist
            htmlContent = htmlContent.replace(
              /<\/head>/,
              `  ${ogImageTag}\n  </head>`,
            );
          }
        }

        // Write updated HTML back to sandbox
        await api.writeFile(sandboxId, "index.html", htmlContent);

        // Update the active fragment to persist changes across reloads
        if (project.activeFragmentId) {
          const fragment = await prisma.v2Fragment.findUnique({
            where: { id: project.activeFragmentId },
            select: { files: true },
          });

          if (fragment) {
            const files = (fragment.files as Record<string, string>) || {};
            files["index.html"] = htmlContent;

            // Track uploaded icon file in fragment (same pattern as generateImage)
            // Store placeholder since images are binary
            if (input.icon?.startsWith("data:image/")) {
              try {
                const iconMatch = input.icon.match(
                  /^data:image\/(\w+);base64,(.+)$/,
                );
                if (iconMatch) {
                  const [, imageType] = iconMatch;
                  const filename = `favicon.${imageType}`;
                  // Store placeholder to track that this file exists (same as generateImage)
                  files[`public/${filename}`] =
                    `[Binary image file: ${filename}]`;
                }
              } catch (e) {
                console.warn(
                  "[updatePublishMetadata] Failed to store icon file in fragment:",
                  e,
                );
              }
            }

            // Track uploaded share image file in fragment (same pattern as generateImage)
            // Store placeholder since images are binary
            if (input.shareImage) {
              try {
                const shareMatch = input.shareImage.match(
                  /^data:image\/(\w+);base64,(.+)$/,
                );
                if (shareMatch) {
                  const [, imageType] = shareMatch;
                  const filename = `share-image.${imageType}`;
                  // Store placeholder to track that this file exists (same as generateImage)
                  files[`public/images/${filename}`] =
                    `[Binary image file: ${filename}]`;
                }
              } catch (e) {
                console.warn(
                  "[updatePublishMetadata] Failed to store share image file in fragment:",
                  e,
                );
              }
            }

            await prisma.v2Fragment.update({
              where: { id: project.activeFragmentId },
              data: { files },
            });
          }
        }

        return {
          success: true,
          message: "Publish metadata updated successfully",
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update publish metadata",
        });
      }
    }),

  /**
   * Get Turso database statistics for a project
   */
  getTursoDatabaseStats: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Check if project has a Turso database
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { tursoDatabaseName: true },
        });

        if (!project?.tursoDatabaseName) {
          return {
            hasDatabase: false,
            stats: null,
          };
        }

        // Fetch database stats from Turso API
        const databaseStats = await getDatabaseStats(input.projectId);

        return {
          hasDatabase: true,
          stats: databaseStats,
        };
      } catch (error) {
        console.error("[getTursoDatabaseStats] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve database statistics",
        });
      }
    }),

  /**
   * Get Turso database usage/activity for a project
   */
  getTursoDatabaseUsage: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Check if project has a Turso database
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { tursoDatabaseName: true },
        });

        if (!project?.tursoDatabaseName) {
          return {
            hasDatabase: false,
            usage: null,
          };
        }

        // Fetch database usage from Turso API
        const databaseUsage = await getDatabaseUsage(input.projectId);

        return {
          hasDatabase: true,
          usage: databaseUsage,
        };
      } catch (error) {
        console.error("[getTursoDatabaseUsage] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve database usage",
        });
      }
    }),

  /**
   * Get list of Turso database tables (metadata only, no data)
   */
  getTursoDatabaseTablesList: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Check if project has a Turso database
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { tursoDatabaseName: true },
        });

        if (!project?.tursoDatabaseName) {
          return {
            hasDatabase: false,
            tables: [],
          };
        }

        // Fetch database tables list (metadata only)
        const tables = await getDatabaseTablesList(input.projectId);

        return {
          hasDatabase: true,
          tables,
        };
      } catch (error) {
        console.error("[getTursoDatabaseTablesList] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve database tables list",
        });
      }
    }),

  /**
   * Get data for a specific table with pagination
   */
  getTursoTableData: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        tableName: z.string().min(1, { message: "Table name is required" }),
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Check if project has a Turso database
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: { tursoDatabaseName: true },
        });

        if (!project?.tursoDatabaseName) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project does not have a database",
          });
        }

        // Fetch table data with pagination
        const tableData = await getTableData(input.projectId, input.tableName, {
          limit: input.limit,
          offset: input.offset,
        });

        return tableData;
      } catch (error) {
        console.error("[getTursoTableData] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve table data",
        });
      }
    }),

  /**
   * Apply direct visual edit changes to sandbox file
   * Creates a snapshot fragment without going through AI chat
   */
  applyDirectVisualEdit: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        filePath: z.string(),
        selector: z.string(),
        elementInfo: z.object({
          componentName: z.string().optional(),
          textContent: z.string().optional(),
          currentClasses: z.array(z.string()),
          shipperId: z.string().optional(),
          isRepeated: z.boolean().optional(),
          instanceIndex: z.number().optional(),
          totalInstances: z.number().optional(),
        }),
        styleChanges: z.record(z.string(), z.string()),
        textChanges: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(
          `[applyDirectVisualEdit] Applying visual edit to file ${input.filePath} in project ${input.projectId}`,
        );
        console.log(`[applyDirectVisualEdit] Input:`, {
          filePath: input.filePath,
          elementInfo: input.elementInfo,
          styleChanges: input.styleChanges,
          textChanges: input.textChanges,
        });

        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project and validate
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            id: true,
            name: true,
            activeFragmentId: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Get sandbox info via unified manager
        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sandbox not found for this project",
          });
        }

        // Read the current file content from sandbox using Modal API
        console.log(
          `[applyDirectVisualEdit] Reading file ${input.filePath} from sandbox`,
        );
        console.log(
          `[applyDirectVisualEdit] Component name:`,
          input.elementInfo.componentName,
        );
        console.log(
          `[applyDirectVisualEdit] Shipper ID:`,
          input.elementInfo.shipperId,
        );

        // Modal uses relative paths (no /home/daytona/workspace prefix)
        let filePath = input.filePath;
        if (filePath.startsWith("/home/daytona/workspace/")) {
          filePath = filePath.replace("/home/daytona/workspace/", "");
        } else if (filePath.startsWith("workspace/")) {
          filePath = filePath.replace("workspace/", "");
        }

        console.log(`[applyDirectVisualEdit] Normalized file path:`, filePath);

        let fileContent: string;
        try {
          fileContent = await modalAPI.readFile(
            sandboxInfo.sandboxId,
            filePath,
          );
        } catch (readError) {
          console.error(
            `[applyDirectVisualEdit] Failed to read file ${filePath}:`,
            readError,
          );

          // Try to find the file by searching all files in the sandbox
          try {
            const allFiles = await modalAPI.listFiles(sandboxInfo.sandboxId);
            const filename = filePath.split("/").pop() || "";
            const matchingFile = Object.keys(allFiles).find(
              (f: string) => f.endsWith(filename) || f.endsWith(`/${filename}`),
            );

            if (matchingFile) {
              console.log(
                `[applyDirectVisualEdit] Found file at different path: ${matchingFile}`,
              );
              // Normalize the path (remove /workspace/ prefix if present)
              const normalizedPath = matchingFile
                .replace(/^\/?workspace\//, "")
                .replace(/^\//, "");
              fileContent = await modalAPI.readFile(
                sandboxInfo.sandboxId,
                normalizedPath,
              );
            } else {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `File not found: ${filePath}. The file may have been moved or deleted. Available files: ${Object.keys(allFiles).slice(0, 10).join(", ")}...`,
                cause: readError,
              });
            }
          } catch (searchError) {
            if (searchError instanceof TRPCError) {
              throw searchError;
            }
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `File not found: ${filePath}. Please ensure the file exists in the sandbox.`,
              cause: readError,
            });
          }
        }

        const lineCount = fileContent.split("\n").length;
        console.log(
          `[applyDirectVisualEdit] File content loaded: ${fileContent.length} chars, ${lineCount} lines`,
        );

        let updatedContent = fileContent;

        // Log if this is a repeated element
        if (input.elementInfo.isRepeated) {
          console.log(
            `[applyDirectVisualEdit] Editing repeated element (instance ${input.elementInfo.instanceIndex} of ${input.elementInfo.totalInstances}). ` +
              `Changes will apply to the template, affecting all ${input.elementInfo.totalInstances} instances.`,
          );
        }

        // Update the file with new Tailwind classes if there are style changes
        if (Object.keys(input.styleChanges).length > 0) {
          console.log(
            `[applyDirectVisualEdit] Updating Tailwind classes:`,
            input.styleChanges,
          );
          const beforeLength = updatedContent.length;

          try {
            updatedContent = updateFileWithTailwindAST(
              updatedContent,
              filePath,
              input.selector,
              input.elementInfo,
              input.styleChanges,
            );
          } catch (updateError) {
            console.error(
              `[applyDirectVisualEdit] Failed to update Tailwind classes:`,
              updateError,
            );
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                updateError instanceof Error
                  ? updateError.message
                  : "Failed to update Tailwind classes",
              cause: updateError,
            });
          }

          const afterLength = updatedContent.length;
          console.log(
            `[applyDirectVisualEdit] File length changed: ${beforeLength} -> ${afterLength} (diff: ${afterLength - beforeLength})`,
          );

          // Verify the change was actually made
          const contentChanged = updatedContent !== fileContent;
          if (!contentChanged) {
            const errorMsg = `Style update failed: File content was not modified. The element may have been moved or modified. Please try selecting it again.`;
            console.error(`[applyDirectVisualEdit] ${errorMsg}`);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: errorMsg,
            });
          }

          console.log(
            `[applyDirectVisualEdit] File content changed successfully`,
          );
        }

        // Update text content if provided
        if (input.textChanges !== undefined && input.textChanges !== null) {
          console.log(
            `[applyDirectVisualEdit] Updating text content:`,
            input.textChanges,
          );
          const beforeTextUpdate = updatedContent.substring(0, 500);
          updatedContent = updateFileWithTextAST(
            updatedContent,
            filePath,
            input.elementInfo,
            input.textChanges,
          );
          const afterTextUpdate = updatedContent.substring(0, 500);
          console.log(`[applyDirectVisualEdit] Text update comparison:`, {
            before: beforeTextUpdate.includes(input.textChanges),
            after: afterTextUpdate.includes(input.textChanges),
            changed: beforeTextUpdate !== afterTextUpdate,
          });
        }

        // Validate the updated content before writing
        console.log(
          `[applyDirectVisualEdit] Validating updated content before writing`,
        );
        const validationErrors = validateJSXContent(updatedContent);
        if (validationErrors.length > 0) {
          const errorMsg = `File validation failed: ${validationErrors.join("; ")}. The file update was aborted to prevent corruption.`;
          console.error(`[applyDirectVisualEdit] ${errorMsg}`);
          console.error(
            `[applyDirectVisualEdit] Problematic content:`,
            updatedContent.substring(0, 1000),
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorMsg,
          });
        }
        console.log(`[applyDirectVisualEdit] Content validation passed`);

        // Write the updated file back to sandbox using Modal API
        console.log(`[applyDirectVisualEdit] Writing updated file to sandbox`);
        console.log(
          `[applyDirectVisualEdit] Updated content preview (first 500 chars):`,
          updatedContent.substring(0, 500),
        );
        await modalAPI.writeFile(
          sandboxInfo.sandboxId,
          filePath,
          updatedContent,
        );

        // Verify the write by reading back
        try {
          const verifyContent = await modalAPI.readFile(
            sandboxInfo.sandboxId,
            filePath,
          );
          if (verifyContent === updatedContent) {
            console.log(
              `[applyDirectVisualEdit] File write verified successfully`,
            );
          } else {
            console.warn(
              `[applyDirectVisualEdit] WARNING: Written file content does not match expected content`,
            );
            console.warn(
              `[applyDirectVisualEdit] Expected length: ${updatedContent.length}, Actual length: ${verifyContent.length}`,
            );
          }
        } catch (verifyError) {
          console.warn(
            `[applyDirectVisualEdit] Could not verify file write:`,
            verifyError,
          );
        }

        // Create a snapshot V2Fragment
        console.log(`[applyDirectVisualEdit] Creating snapshot fragment`);

        // Get all files from the current fragment to create snapshot
        let fragmentFiles: Record<string, string> = {};

        if (project.activeFragmentId) {
          const currentFragment = await prisma.v2Fragment.findUnique({
            where: { id: project.activeFragmentId },
            select: { files: true },
          });

          if (
            currentFragment?.files &&
            typeof currentFragment.files === "object"
          ) {
            fragmentFiles = currentFragment.files as Record<string, string>;
          }
        }

        // Update the modified file in the fragment
        // Use the original input.filePath as the key to match fragment file structure
        console.log(
          `[applyDirectVisualEdit] Storing in fragment with key:`,
          input.filePath,
        );
        console.log(
          `[applyDirectVisualEdit] Existing fragment file keys:`,
          Object.keys(fragmentFiles).filter((k) => k.includes("App")),
        );
        fragmentFiles[input.filePath] = updatedContent;

        // Extract component code snippets for undo/redo
        // We'll store a reasonable chunk around the edited element
        let beforeSnapshot = "";
        let afterSnapshot = "";

        if (input.elementInfo.shipperId) {
          // Parse shipperId format: "filename:line:column"
          const shipperIdParts = input.elementInfo.shipperId.split(":");
          if (shipperIdParts.length >= 2) {
            const lineNumber = parseInt(shipperIdParts[1], 10);

            // Extract context lines before and after the edited line
            const contextLines = COMPONENT_SNAPSHOT_CONTEXT_LINES;
            const beforeLines = fileContent.split("\n");
            const afterLines = updatedContent.split("\n");

            const startLine = Math.max(0, lineNumber - contextLines);
            const endLine = Math.min(
              beforeLines.length,
              lineNumber + contextLines,
            );

            beforeSnapshot = beforeLines.slice(startLine, endLine).join("\n");
            afterSnapshot = afterLines.slice(startLine, endLine).join("\n");

            console.log(
              `[applyDirectVisualEdit] Extracted component snapshot: lines ${startLine}-${endLine}`,
            );
          }
        } else {
          // Fallback: store entire file if no shipperId (less ideal but still useful)
          beforeSnapshot = fileContent;
          afterSnapshot = updatedContent;
          console.log(
            `[applyDirectVisualEdit] No shipperId, storing entire file as snapshot`,
          );
        }

        // Create snapshot fragment with ISO timestamp for consistency
        const timestamp = new Date().toISOString();
        const fragment = await prisma.v2Fragment.create({
          data: {
            title: `Visual edit snapshot - ${timestamp}`,
            files: fragmentFiles,
            projectId: input.projectId,
          },
        });

        // Store component edit metadata for undo/redo
        const changeType =
          Object.keys(input.styleChanges).length > 0 && input.textChanges
            ? "combined"
            : Object.keys(input.styleChanges).length > 0
              ? "style"
              : "text";

        await prisma.componentEditMetadata.create({
          data: {
            fragmentId: fragment.id,
            projectId: input.projectId,
            filePath: input.filePath,
            shipperId: input.elementInfo.shipperId || null,
            selector: input.selector,
            componentName: input.elementInfo.componentName || null,
            isRepeated: input.elementInfo.isRepeated || false,
            instanceIndex: input.elementInfo.instanceIndex || null,
            totalInstances: input.elementInfo.totalInstances || null,
            changeType,
            beforeSnapshot,
            afterSnapshot,
            styleChanges:
              Object.keys(input.styleChanges).length > 0
                ? input.styleChanges
                : undefined,
            textChanges: input.textChanges || null,
          },
        });

        console.log(
          `[applyDirectVisualEdit] Successfully applied visual edit, created fragment ${fragment.id}, and stored component metadata`,
        );

        // Update project's active fragment
        await prisma.project.update({
          where: { id: input.projectId },
          data: { activeFragmentId: fragment.id },
        });

        return {
          success: true,
          fragmentId: fragment.id,
          message: "Visual edit applied successfully",
        };
      } catch (error) {
        console.error("[applyDirectVisualEdit] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to apply visual edit",
        });
      }
    }),

  /**
   * Get component edit history for a specific component
   * Returns all edits made to a component, ordered by most recent first
   */
  getComponentEditHistory: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        filePath: z.string(),
        shipperId: z.string().optional(),
        selector: z.string().optional(),
        limit: z.number().optional().default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check project access
      const hasAccess = await checkProjectAccess(input.projectId, ctx.user.id);
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this project",
        });
      }

      // Build where clause
      const where: Prisma.ComponentEditMetadataWhereInput = {
        projectId: input.projectId,
        filePath: input.filePath,
      };

      if (input.shipperId) {
        where.shipperId = input.shipperId;
      } else if (input.selector) {
        where.selector = input.selector;
      }

      const edits = await prisma.componentEditMetadata.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          fragment: {
            select: {
              id: true,
              title: true,
              createdAt: true,
            },
          },
        },
      });

      return edits;
    }),

  /**
   * Undo a component edit by reverting to its previous state
   * Creates a new fragment with the component reverted
   */
  undoComponentEdit: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        editMetadataId: z.string(), // ID of the ComponentEditMetadata to undo
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(
          `[undoComponentEdit] Undoing component edit ${input.editMetadataId} in project ${input.projectId}`,
        );

        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get the edit metadata
        const editMetadata = await prisma.componentEditMetadata.findUnique({
          where: { id: input.editMetadataId },
        });

        if (!editMetadata) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Edit metadata not found",
          });
        }

        if (editMetadata.projectId !== input.projectId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Edit metadata does not belong to this project",
          });
        }

        // Get project and sandbox info
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            id: true,
            name: true,
            activeFragmentId: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sandbox not found for this project",
          });
        }

        // Normalize file path
        let filePath = editMetadata.filePath;
        if (filePath.startsWith("/home/daytona/workspace/")) {
          filePath = filePath.replace("/home/daytona/workspace/", "");
        } else if (filePath.startsWith("workspace/")) {
          filePath = filePath.replace("workspace/", "");
        }

        // Read current file content
        const currentContent = await modalAPI.readFile(
          sandboxInfo.sandboxId,
          filePath,
        );

        // Apply the "before" snapshot to revert the change
        // We need to replace the component section with the beforeSnapshot
        let revertedContent = currentContent;

        if (editMetadata.shipperId) {
          // Parse shipperId to get line number
          const shipperIdParts = editMetadata.shipperId.split(":");
          if (shipperIdParts.length >= 2) {
            const lineNumber = parseInt(shipperIdParts[1], 10);
            const contextLines = COMPONENT_SNAPSHOT_CONTEXT_LINES;

            const currentLines = currentContent.split("\n");
            const startLine = Math.max(0, lineNumber - contextLines);
            const endLine = Math.min(
              currentLines.length,
              lineNumber + contextLines,
            );

            // Replace the section with the before snapshot
            const beforeLines = editMetadata.beforeSnapshot.split("\n");
            const newLines = [
              ...currentLines.slice(0, startLine),
              ...beforeLines,
              ...currentLines.slice(endLine),
            ];

            revertedContent = newLines.join("\n");
            console.log(
              `[undoComponentEdit] Reverted component at lines ${startLine}-${endLine}`,
            );
          }
        } else {
          // Fallback: use entire beforeSnapshot if no shipperId
          revertedContent = editMetadata.beforeSnapshot;
          console.log(
            `[undoComponentEdit] Reverted entire file (no shipperId)`,
          );
        }

        // Validate the reverted content
        const validationErrors = validateJSXContent(revertedContent);
        if (validationErrors.length > 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Undo validation failed: ${validationErrors.join("; ")}`,
          });
        }

        // Write the reverted file back to sandbox
        await modalAPI.writeFile(
          sandboxInfo.sandboxId,
          filePath,
          revertedContent,
        );
        console.log(`[undoComponentEdit] Wrote reverted file to sandbox`);

        // Create a new fragment with the reverted state
        const timestamp = new Date().toISOString();
        let fragmentFiles: Record<string, string> = {};

        if (project.activeFragmentId) {
          const currentFragment = await prisma.v2Fragment.findUnique({
            where: { id: project.activeFragmentId },
            select: { files: true },
          });

          if (
            currentFragment?.files &&
            typeof currentFragment.files === "object"
          ) {
            fragmentFiles = currentFragment.files as Record<string, string>;
          }
        }

        fragmentFiles[editMetadata.filePath] = revertedContent;

        const fragment = await prisma.v2Fragment.create({
          data: {
            title: `Undo: ${editMetadata.componentName || "component"} - ${timestamp}`,
            files: fragmentFiles,
            projectId: input.projectId,
          },
        });

        // Store metadata for this undo operation (so it can be redone)
        await prisma.componentEditMetadata.create({
          data: {
            fragmentId: fragment.id,
            projectId: input.projectId,
            filePath: editMetadata.filePath,
            shipperId: editMetadata.shipperId,
            selector: editMetadata.selector,
            componentName: editMetadata.componentName,
            isRepeated: editMetadata.isRepeated,
            instanceIndex: editMetadata.instanceIndex,
            totalInstances: editMetadata.totalInstances,
            changeType: "undo",
            beforeSnapshot: editMetadata.afterSnapshot, // Swap: before is now the "after" state
            afterSnapshot: editMetadata.beforeSnapshot, // Swap: after is now the "before" state
            styleChanges: undefined,
            textChanges: null,
          },
        });

        // Update project's active fragment
        await prisma.project.update({
          where: { id: input.projectId },
          data: { activeFragmentId: fragment.id },
        });

        console.log(
          `[undoComponentEdit] Successfully undid component edit and created fragment ${fragment.id}`,
        );

        return {
          success: true,
          fragmentId: fragment.id,
          message: "Component edit undone successfully",
        };
      } catch (error) {
        console.error("[undoComponentEdit] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to undo component edit",
        });
      }
    }),

  /**
   * Apply multiple direct visual edits in a batch
   * More efficient than calling applyDirectVisualEdit multiple times
   */
  applyBatchedVisualEdits: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        edits: z.array(
          z.object({
            filePath: z.string(),
            selector: z.string(),
            elementInfo: z.object({
              componentName: z.string().optional(),
              textContent: z.string().optional(),
              currentClasses: z.array(z.string()),
              shipperId: z.string().optional(),
              isRepeated: z.boolean().optional(),
              instanceIndex: z.number().optional(),
              totalInstances: z.number().optional(),
            }),
            styleChanges: z.record(z.string(), z.string()),
            textChanges: z.string().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        console.log(
          `[applyBatchedVisualEdits] Applying ${input.edits.length} edits to project ${input.projectId}`,
        );

        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project and validate
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            id: true,
            name: true,
            activeFragmentId: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Get sandbox info
        const sandboxInfo = await getSandbox(input.projectId);
        if (!sandboxInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Sandbox not found for this project",
          });
        }

        // Group edits by file path
        const editsByFile = new Map<string, typeof input.edits>();
        for (const edit of input.edits) {
          let filePath = edit.filePath;
          // Normalize path
          if (filePath.startsWith("/home/daytona/workspace/")) {
            filePath = filePath.replace("/home/daytona/workspace/", "");
          } else if (filePath.startsWith("workspace/")) {
            filePath = filePath.replace("workspace/", "");
          }

          const existing = editsByFile.get(filePath) || [];
          existing.push({ ...edit, filePath });
          editsByFile.set(filePath, existing);
        }

        console.log(
          `[applyBatchedVisualEdits] Grouped ${input.edits.length} edits into ${editsByFile.size} files`,
        );

        // Process each file sequentially
        const results: Array<{
          filePath: string;
          success: boolean;
          error?: string;
        }> = [];

        for (const [filePath, fileEdits] of editsByFile.entries()) {
          console.log(
            `[applyBatchedVisualEdits] Processing ${fileEdits.length} edits for file: ${filePath}`,
          );

          try {
            // Read file once
            let fileContent = await modalAPI.readFile(
              sandboxInfo.sandboxId,
              filePath,
            );
            console.log(
              `[applyBatchedVisualEdits] Read file ${filePath}: ${fileContent.length} chars`,
            );

            // Apply each edit sequentially to the same file content
            for (let i = 0; i < fileEdits.length; i++) {
              const edit = fileEdits[i];
              console.log(
                `[applyBatchedVisualEdits] Applying edit ${i + 1}/${fileEdits.length} to ${filePath} (shipperId: ${edit.elementInfo.shipperId})`,
              );

              // Update styles
              if (Object.keys(edit.styleChanges).length > 0) {
                const beforeLength = fileContent.length;
                fileContent = updateFileWithTailwindAST(
                  fileContent,
                  filePath,
                  edit.selector,
                  edit.elementInfo,
                  edit.styleChanges,
                );
                console.log(
                  `[applyBatchedVisualEdits] Style update ${i + 1}: ${beforeLength} -> ${fileContent.length} chars`,
                );
              }

              // Update text
              if (edit.textChanges !== undefined && edit.textChanges !== null) {
                fileContent = updateFileWithTextAST(
                  fileContent,
                  filePath,
                  edit.elementInfo,
                  edit.textChanges,
                );
                console.log(
                  `[applyBatchedVisualEdits] Text update ${i + 1} applied`,
                );
              }
            }

            // Validate the final result
            console.log(
              `[applyBatchedVisualEdits] Validating final content for ${filePath}`,
            );
            const validationErrors = validateJSXContent(fileContent);
            if (validationErrors.length > 0) {
              throw new Error(
                `File validation failed: ${validationErrors.join("; ")}`,
              );
            }

            // Write once
            console.log(
              `[applyBatchedVisualEdits] Writing updated file: ${filePath}`,
            );
            await modalAPI.writeFile(
              sandboxInfo.sandboxId,
              filePath,
              fileContent,
            );

            results.push({ filePath, success: true });
          } catch (error) {
            console.error(
              `[applyBatchedVisualEdits] Failed to process ${filePath}:`,
              error,
            );
            results.push({
              filePath,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        // Get fragment files
        let fragmentFiles: Record<string, string> = {};
        if (project.activeFragmentId) {
          const currentFragment = await prisma.v2Fragment.findUnique({
            where: { id: project.activeFragmentId },
            select: { files: true },
          });
          if (
            currentFragment?.files &&
            typeof currentFragment.files === "object"
          ) {
            fragmentFiles = currentFragment.files as Record<string, string>;
          }
        }

        // Update fragment with all modified files
        for (const result of results) {
          if (result.success) {
            const fileContent = await modalAPI.readFile(
              sandboxInfo.sandboxId,
              result.filePath,
            );
            // Use original file path format for fragment key
            const originalEdit = input.edits.find(
              (e) =>
                e.filePath.endsWith(result.filePath) ||
                result.filePath.endsWith(e.filePath),
            );
            const fragmentKey = originalEdit?.filePath || result.filePath;
            fragmentFiles[fragmentKey] = fileContent;
          }
        }

        // Create snapshot fragment with ISO timestamp for consistency
        const timestamp = new Date().toISOString();
        const fragment = await prisma.v2Fragment.create({
          data: {
            title: `Visual edit batch - ${timestamp}`,
            files: fragmentFiles,
            projectId: input.projectId,
          },
        });

        // Update project's active fragment
        await prisma.project.update({
          where: { id: input.projectId },
          data: { activeFragmentId: fragment.id },
        });

        const successCount = results.filter((r) => r.success).length;
        console.log(
          `[applyBatchedVisualEdits] Completed: ${successCount}/${results.length} files updated successfully`,
        );

        return {
          success: true,
          fragmentId: fragment.id,
          results,
          message: `Applied ${successCount} of ${results.length} file changes`,
        };
      } catch (error) {
        console.error("[applyBatchedVisualEdits] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to apply batched visual edits",
        });
      }
    }),

  /**
   * Get Convex deployment information for a project
   */
  getConvexDeploymentInfo: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Check if project has Convex deployment
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            shipperCloudEnabled: true,
            convexDeployment: {
              select: {
                id: true,
                convexProjectId: true,
                convexDeploymentName: true,
                convexDeploymentUrl: true,
                status: true,
                lastDeployedAt: true,
                lastDeployError: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

        if (!project?.shipperCloudEnabled || !project.convexDeployment) {
          return {
            hasConvex: false,
            deployment: null,
          };
        }

        return {
          hasConvex: true,
          deployment: project.convexDeployment,
        };
      } catch (error) {
        console.error("[getConvexDeploymentInfo] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve Convex deployment information",
        });
      }
    }),

  /**
   * Get Convex dashboard credentials for embedded iframe
   * Returns the decrypted deploy key for postMessage authentication
   */
  getConvexDashboardCredentials: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get Convex deployment with encrypted deploy key
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            shipperCloudEnabled: true,
            convexDeployment: {
              select: {
                convexDeploymentName: true,
                convexDeploymentUrl: true,
                deployKeyEncrypted: true,
                status: true,
              },
            },
          },
        });

        if (!project?.shipperCloudEnabled || !project.convexDeployment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No Convex deployment found for this project",
          });
        }

        // Decrypt the deploy key
        const deployKey = decryptDeployKey(
          project.convexDeployment.deployKeyEncrypted,
        );

        return {
          deploymentUrl: project.convexDeployment.convexDeploymentUrl,
          deploymentName: project.convexDeployment.convexDeploymentName,
          adminKey: deployKey,
        };
      } catch (error) {
        console.error("[getConvexDashboardCredentials] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve Convex dashboard credentials",
        });
      }
    }),

  /**
   * Get Convex tables and schemas for a project
   */
  getConvexTables: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project with Convex deployment
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            shipperCloudEnabled: true,
            convexDeployment: {
              select: {
                convexDeploymentUrl: true,
                deployKeyEncrypted: true,
              },
            },
          },
        });

        if (!project?.shipperCloudEnabled || !project.convexDeployment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project does not have a Convex deployment",
          });
        }

        const { ConvexDataService } = await import("@/lib/convex-data-service");
        const convexService = new ConvexDataService(
          project.convexDeployment.convexDeploymentUrl,
          project.convexDeployment.deployKeyEncrypted,
        );

        const tables = await convexService.getTablesAndSchemas();

        // Get row counts for each table (async in parallel)
        const tablesWithCounts = await Promise.all(
          tables.map(async (table) => {
            try {
              const count = await convexService.getTableRowCount(table.name);
              return { ...table, documentCount: count };
            } catch {
              return { ...table, documentCount: 0 };
            }
          }),
        );

        return {
          tables: tablesWithCounts,
        };
      } catch (error) {
        console.error("[getConvexTables] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve Convex tables",
        });
      }
    }),

  /**
   * Get data from a specific Convex table
   */
  getConvexTableData: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        tableName: z.string().min(1, { message: "Table name is required" }),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project with Convex deployment
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            shipperCloudEnabled: true,
            convexDeployment: {
              select: {
                convexDeploymentUrl: true,
                deployKeyEncrypted: true,
              },
            },
          },
        });

        if (!project?.shipperCloudEnabled || !project.convexDeployment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project does not have a Convex deployment",
          });
        }

        const { ConvexDataService } = await import("@/lib/convex-data-service");
        const convexService = new ConvexDataService(
          project.convexDeployment.convexDeploymentUrl,
          project.convexDeployment.deployKeyEncrypted,
        );

        const result = await convexService.getTableDocuments(input.tableName, {
          cursor: input.cursor,
          limit: input.limit,
        });

        return {
          documents: result.values,
          hasMore: result.hasMore,
          cursor: result.cursor,
        };
      } catch (error) {
        console.error("[getConvexTableData] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve Convex table data",
        });
      }
    }),

  /**
   * Get Convex users (from Better Auth user table)
   */
  getConvexUsers: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        limit: z.number().min(1).max(100).optional().default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project with Convex deployment
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            shipperCloudEnabled: true,
            convexDeployment: {
              select: {
                convexDeploymentUrl: true,
                deployKeyEncrypted: true,
              },
            },
          },
        });

        if (!project?.shipperCloudEnabled || !project.convexDeployment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project does not have a Convex deployment",
          });
        }

        const { ConvexDataService } = await import("@/lib/convex-data-service");
        const convexService = new ConvexDataService(
          project.convexDeployment.convexDeploymentUrl,
          project.convexDeployment.deployKeyEncrypted,
        );

        const users = await convexService.getUsers(input.limit);

        return {
          users,
          totalCount: users.length,
        };
      } catch (error) {
        console.error("[getConvexUsers] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve Convex users",
        });
      }
    }),

  /**
   * Create a new Convex user
   */
  createConvexUser: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        email: z.string().email({ message: "Valid email is required" }),
        name: z.string().optional(),
        password: z
          .string()
          .min(8, { message: "Password must be at least 8 characters" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project with Convex deployment
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            shipperCloudEnabled: true,
            convexDeployment: {
              select: {
                convexDeploymentUrl: true,
                deployKeyEncrypted: true,
              },
            },
          },
        });

        if (!project?.shipperCloudEnabled || !project.convexDeployment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project does not have a Convex deployment",
          });
        }

        const { ConvexDataService } = await import("@/lib/convex-data-service");
        const convexService = new ConvexDataService(
          project.convexDeployment.convexDeploymentUrl,
          project.convexDeployment.deployKeyEncrypted,
        );

        const result = await convexService.createUser({
          email: input.email,
          name: input.name,
          password: input.password,
        });

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to create user",
          });
        }

        return {
          success: true,
          userId: result.userId,
        };
      } catch (error) {
        console.error("[createConvexUser] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to create Convex user",
        });
      }
    }),

  /**
   * Delete a Convex user
   */
  deleteConvexUser: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        userId: z.string().min(1, { message: "User ID is required" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project with Convex deployment
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            shipperCloudEnabled: true,
            convexDeployment: {
              select: {
                convexDeploymentUrl: true,
                deployKeyEncrypted: true,
              },
            },
          },
        });

        if (!project?.shipperCloudEnabled || !project.convexDeployment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project does not have a Convex deployment",
          });
        }

        const { ConvexDataService } = await import("@/lib/convex-data-service");
        const convexService = new ConvexDataService(
          project.convexDeployment.convexDeploymentUrl,
          project.convexDeployment.deployKeyEncrypted,
        );

        const result = await convexService.deleteUser(input.userId);

        if (!result.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: result.error || "Failed to delete user",
          });
        }

        return {
          success: true,
        };
      } catch (error) {
        console.error("[deleteConvexUser] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to delete Convex user",
        });
      }
    }),

  /**
   * Update project deployment URL (used when custom domain becomes active)
   * NOTE: This preserves the subdomain field - only updates deploymentUrl
   */
  updateDeploymentUrl: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
        deploymentUrl: z.string().url({ message: "Valid URL is required" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Update the project's deployment URL (subdomain is preserved)
        const updatedProject = await prisma.project.update({
          where: { id: input.projectId },
          data: {
            deploymentUrl: input.deploymentUrl,
            updatedAt: new Date(),
          },
          select: {
            id: true,
            deploymentUrl: true,
            subdomain: true,
          },
        });

        console.log("[updateDeploymentUrl] Updated deployment URL:", {
          projectId: input.projectId,
          deploymentUrl: updatedProject.deploymentUrl,
          subdomain: updatedProject.subdomain,
        });

        return {
          success: true,
          deploymentUrl: updatedProject.deploymentUrl,
          subdomain: updatedProject.subdomain,
        };
      } catch (error) {
        console.error("[updateDeploymentUrl] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update deployment URL",
        });
      }
    }),

  /**
   * Initialize sandbox for an imported project
   * This is called when a project with AWAITING_SANDBOX status is loaded
   */
  initializeImportedProjectSandbox: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project with codeImport to verify it's an imported project
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          include: {
            codeImport: true,
            v2Fragments: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        if (!project) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Verify this is an imported project awaiting sandbox
        if (project.buildStatus !== "AWAITING_SANDBOX") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Project is not awaiting sandbox initialization. Current status: ${project.buildStatus}`,
          });
        }

        if (!project.codeImport) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Project is not an imported project",
          });
        }

        console.log(
          "[initializeImportedProjectSandbox] Starting sandbox creation for imported project:",
          {
            projectId: input.projectId,
            framework: project.codeImport.detectedFramework,
            fileCount: project.codeImport.fileCount,
          },
        );

        // Update build status to INITIALIZING
        await prisma.project.update({
          where: { id: input.projectId },
          data: {
            buildStatus: "INITIALIZING",
            buildStatusUpdatedAt: new Date(),
          },
        });

        // Create sandbox using the empty template for imported projects
        // The createSandbox function handles:
        // - Restoring fragment files
        // - Running bun install
        // - Patching vite.config with shipper-ids plugin
        // - Starting the dev server
        const templateName = "shipper-empty-bun-template";
        const sandbox = await createSandbox(
          input.projectId,
          project.activeFragmentId,
          templateName,
          {
            isImportedProject: true,
            importedFrom:
              project.importedFrom ?? project.codeImport?.importedFrom ?? null,
          },
        );

        if (!sandbox || !sandbox.sandboxId) {
          throw new Error("Failed to create sandbox");
        }

        console.log("[initializeImportedProjectSandbox] Sandbox created:", {
          projectId: input.projectId,
          sandboxId: sandbox.sandboxId,
          sandboxUrl: sandbox.sandboxUrl,
        });

        // Update project with sandbox info and mark as READY
        await prisma.project.update({
          where: { id: input.projectId },
          data: {
            sandboxId: sandbox.sandboxId,
            sandboxUrl: sandbox.sandboxUrl,
            sandboxCreatedAt: new Date(),
            sandboxProvider: "modal",
            buildStatus: "READY",
            buildStatusUpdatedAt: new Date(),
          },
        });

        console.log(
          "[initializeImportedProjectSandbox] Sandbox initialization complete:",
          {
            projectId: input.projectId,
            sandboxId: sandbox.sandboxId,
          },
        );

        return {
          success: true,
          sandboxId: sandbox.sandboxId,
          sandboxUrl: sandbox.sandboxUrl,
        };
      } catch (error) {
        console.error("[initializeImportedProjectSandbox] Error:", error);

        // Update build status to ERROR
        await prisma.project.update({
          where: { id: input.projectId },
          data: {
            buildStatus: "ERROR",
            buildError:
              error instanceof Error
                ? error.message
                : "Failed to initialize sandbox",
            buildStatusUpdatedAt: new Date(),
          },
        });

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to initialize imported project sandbox",
        });
      }
    }),

  /**
   * Get Shipper Cloud billing breakdown for a project
   * Returns usage metrics and pricing breakdown for the current billing period
   */
  getShipperCloudBilling: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        // Check project access
        const hasAccess = await checkProjectAccess(
          input.projectId,
          ctx.user.id,
        );
        if (!hasAccess) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this project",
          });
        }

        // Get project with Convex deployment
        const project = await prisma.project.findUnique({
          where: { id: input.projectId },
          select: {
            shipperCloudEnabled: true,
            convexDeployment: {
              select: {
                id: true,
                status: true,
                currentPeriodStart: true,
                currentPeriodEnd: true,
                creditsUsedThisPeriod: true,
                totalFunctionCalls: true,
                totalActionComputeMs: true,
                totalDatabaseBandwidthBytes: true,
                totalFileBandwidthBytes: true,
                totalVectorBandwidthBytes: true,
                documentStorageBytes: true,
                indexStorageBytes: true,
                fileStorageBytes: true,
                vectorStorageBytes: true,
                backupStorageBytes: true,
                lastStorageUpdateAt: true,
                lastUsageAt: true,
              },
            },
          },
        });

        if (!project?.shipperCloudEnabled || !project.convexDeployment) {
          return {
            hasShipperCloud: false,
            billing: null,
          };
        }

        const deployment = project.convexDeployment;

        // Shipper Cloud pricing rates (in credits, where 1 credit = $0.01)
        const SHIPPER_RATES = {
          functionCallsPerMillion: 300, // $3.00 per million
          actionComputePerGBHour: 45, // $0.45 per GB-hour
          databaseBandwidthPerGB: 30, // $0.30 per GB
          fileBandwidthPerGB: 45, // $0.45 per GB
          vectorBandwidthPerGB: 15, // $0.15 per GB
        };

        const BYTES_PER_GB = 1024 * 1024 * 1024;
        const MS_PER_HOUR = 3600000;
        const MB_PER_GB = 1024;
        const MEMORY_MB = 128;

        const functionCalls = Number(deployment.totalFunctionCalls);
        const actionComputeMs = Number(deployment.totalActionComputeMs);
        const databaseBandwidth = Number(deployment.totalDatabaseBandwidthBytes);
        const fileBandwidth = Number(deployment.totalFileBandwidthBytes);
        const vectorBandwidth = Number(deployment.totalVectorBandwidthBytes);

        // Calculate credits for each meter
        const functionCallsCredits =
          (functionCalls / 1_000_000) * SHIPPER_RATES.functionCallsPerMillion;
        const actionComputeCredits =
          (MEMORY_MB / MB_PER_GB) *
          (actionComputeMs / MS_PER_HOUR) *
          SHIPPER_RATES.actionComputePerGBHour;
        const databaseBandwidthCredits =
          (databaseBandwidth / BYTES_PER_GB) * SHIPPER_RATES.databaseBandwidthPerGB;
        const fileBandwidthCredits =
          (fileBandwidth / BYTES_PER_GB) * SHIPPER_RATES.fileBandwidthPerGB;
        const vectorBandwidthCredits =
          (vectorBandwidth / BYTES_PER_GB) * SHIPPER_RATES.vectorBandwidthPerGB;

        const totalCalculatedCredits =
          functionCallsCredits +
          actionComputeCredits +
          databaseBandwidthCredits +
          fileBandwidthCredits +
          vectorBandwidthCredits;

        // Format display values
        const formatCredits = (credits: number) => ({
          raw: credits,
          display: `${credits.toFixed(2)} credits`,
          usd: `$${(credits / 100).toFixed(2)}`,
        });

        return {
          hasShipperCloud: true,
          billing: {
            status: deployment.status,
            periodStart: deployment.currentPeriodStart?.toISOString() ?? null,
            periodEnd: deployment.currentPeriodEnd?.toISOString() ?? null,
            lastUsageAt: deployment.lastUsageAt?.toISOString() ?? null,
            totalCreditsUsed: formatCredits(deployment.creditsUsedThisPeriod),
            breakdown: {
              functionCalls: {
                usage: functionCalls,
                usageFormatted:
                  functionCalls < 1000
                    ? `${functionCalls} calls`
                    : functionCalls < 1_000_000
                      ? `${(functionCalls / 1000).toFixed(1)}K calls`
                      : `${(functionCalls / 1_000_000).toFixed(3)}M calls`,
                credits: formatCredits(functionCallsCredits),
                rate: "$3.00 per million calls",
              },
              actionCompute: {
                usage: actionComputeMs,
                usageFormatted: `${((MEMORY_MB / MB_PER_GB) * (actionComputeMs / MS_PER_HOUR)).toFixed(4)} GB-hrs`,
                credits: formatCredits(actionComputeCredits),
                rate: "$0.45 per GB-hour",
              },
              databaseBandwidth: {
                usage: databaseBandwidth,
                usageFormatted: `${(databaseBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
                credits: formatCredits(databaseBandwidthCredits),
                rate: "$0.30 per GB",
              },
              fileBandwidth: {
                usage: fileBandwidth,
                usageFormatted: `${(fileBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
                credits: formatCredits(fileBandwidthCredits),
                rate: "$0.45 per GB",
              },
              vectorBandwidth: {
                usage: vectorBandwidth,
                usageFormatted: `${(vectorBandwidth / BYTES_PER_GB).toFixed(4)} GB`,
                credits: formatCredits(vectorBandwidthCredits),
                rate: "$0.15 per GB",
              },
            },
            storage: {
              document: {
                bytes: Number(deployment.documentStorageBytes),
                formatted: `${(Number(deployment.documentStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
              },
              index: {
                bytes: Number(deployment.indexStorageBytes),
                formatted: `${(Number(deployment.indexStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
              },
              file: {
                bytes: Number(deployment.fileStorageBytes),
                formatted: `${(Number(deployment.fileStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
              },
              vector: {
                bytes: Number(deployment.vectorStorageBytes),
                formatted: `${(Number(deployment.vectorStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
              },
              backup: {
                bytes: Number(deployment.backupStorageBytes),
                formatted: `${(Number(deployment.backupStorageBytes) / BYTES_PER_GB).toFixed(4)} GB`,
              },
              lastUpdated: deployment.lastStorageUpdateAt?.toISOString() ?? null,
            },
          },
        };
      } catch (error) {
        console.error("[getShipperCloudBilling] Error:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve Shipper Cloud billing information",
        });
      }
    }),
});
