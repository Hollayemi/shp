import {
  baseProcedure,
  protectedProcedure,
  adminProcedure,
  createTRPCRouter,
} from "@/trpc/init";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { CreditManager } from "@/lib/credits";
import {
  generateSlugFromName,
  generateProjectMetadata,
} from "@/lib/project-namer";
import { createSandbox } from "@/lib/sandbox-manager";
import {
  getSandboxProvider,
  setSandboxProvider,
  getDefaultProvider,
} from "@/lib/sandbox-provider-utils";

// ============================================
// CONSTANTS
// ============================================

/**
 * Base credit cost for remixing any template
 * This covers the operational cost of creating a new project,
 * initializing a sandbox, and copying template files.
 * Separate from any template purchase price.
 */
const REMIX_OPERATION_COST = 1;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a URL-friendly slug from a template name
 */
function generateTemplateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Get or create user's personal team
 */
async function getOrCreatePersonalTeam(userId: string) {
  // First, try to find existing personal team
  const existingTeam = await prisma.team.findFirst({
    where: {
      isPersonal: true,
      members: {
        some: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  if (existingTeam) {
    return existingTeam;
  }

  // Create personal team if doesn't exist
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const team = await prisma.team.create({
    data: {
      name: `${user?.name || "My"}'s Workspace`,
      slug: `personal-${nanoid(10)}`,
      isPersonal: true,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  return team;
}

/**
 * Generate unique project name for remix
 */
async function generateUniqueProjectName(baseName: string): Promise<string> {
  let name = generateSlugFromName(baseName);
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const existingProject = await prisma.project.findFirst({
      where: { name },
    });

    if (!existingProject) {
      return name;
    }

    // Add suffix if name exists
    name = `${generateSlugFromName(baseName)}-${nanoid(6)}`;
    attempts++;
  }

  // Fallback
  return `${generateSlugFromName(baseName)}-${nanoid(10)}`;
}

// ============================================
// TEMPLATES ROUTER
// ============================================

export const templatesRouter = createTRPCRouter({
  // ============================================
  // TEMPLATE DISCOVERY (Public)
  // ============================================

  /**
   * Get featured templates for homepage
   */
  getFeatured: baseProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(6),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit, offset } = input;

      const templates = await prisma.communityTemplate.findMany({
        where: {
          featured: true,
          published: true,
        },
        take: limit,
        skip: offset,
        orderBy: [{ createdAt: "desc" }],
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          sourceProject: {
            select: {
              id: true,
              sandboxUrl: true,
              deploymentUrl: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              saves: true,
              remixes: true,
            },
          },
        },
      });

      // If authenticated, check user's interaction status
      const userInteractions: Record<
        string,
        { liked: boolean; saved: boolean }
      > = {};

      if (ctx.session?.user?.id) {
        const templateIds = templates.map((t) => t.id);

        const [likes, saves] = await Promise.all([
          prisma.templateLike.findMany({
            where: {
              userId: ctx.session.user.id,
              templateId: { in: templateIds },
            },
            select: { templateId: true },
          }),
          prisma.templateSave.findMany({
            where: {
              userId: ctx.session.user.id,
              templateId: { in: templateIds },
            },
            select: { templateId: true },
          }),
        ]);

        const likedIds = new Set(likes.map((l) => l.templateId));
        const savedIds = new Set(saves.map((s) => s.templateId));

        templateIds.forEach((id) => {
          userInteractions[id] = {
            liked: likedIds.has(id),
            saved: savedIds.has(id),
          };
        });
      }

      return {
        templates: templates.map((template) => ({
          ...template,
          likeCount: template._count.likes,
          commentCount: template._count.comments,
          saveCount: template._count.saves,
          remixCount: template._count.remixes + template.remixCount, // Include stored count
          userLiked: userInteractions[template.id]?.liked || false,
          userSaved: userInteractions[template.id]?.saved || false,
        })),
        total: templates.length,
      };
    }),

  /**
   * Get templates by category with filters
   */
  getByCategory: baseProcedure
    .input(
      z.object({
        categorySlug: z.string().optional(),
        tags: z.array(z.string()).optional(),
        sortBy: z.enum(["newest", "popular", "trending"]).default("popular"),
        limit: z.number().min(1).max(50).default(12),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { categorySlug, tags, sortBy, limit, offset } = input;

      // Build where clause
      const where: any = {
        published: true,
      };

      if (categorySlug) {
        where.category = { slug: categorySlug };
      }

      if (tags && tags.length > 0) {
        where.tags = { hasSome: tags };
      }

      // Build order by
      let orderBy: any = [];
      switch (sortBy) {
        case "newest":
          orderBy = [{ createdAt: "desc" }];
          break;
        case "popular":
          // Popular: All-time popularity based on total remixes and views
          orderBy = [{ remixCount: "desc" }, { viewCount: "desc" }];
          break;
        case "trending":
          // Trending: Heuristic that favors templates with high engagement
          // (remixes + views) that are also relatively recent
          // Note: For more accurate trending based on recent activity,
          // use the getTrending endpoint which calculates based on remixes
          // within a specific timeframe
          orderBy = [
            { remixCount: "desc" },
            { viewCount: "desc" },
            { createdAt: "desc" },
          ];
          break;
      }

      const [templates, totalCount] = await Promise.all([
        prisma.communityTemplate.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy,
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            sourceProject: {
              select: {
                id: true,
                sandboxUrl: true,
                deploymentUrl: true,
              },
            },
            _count: {
              select: {
                likes: true,
                comments: true,
                saves: true,
                remixes: true,
              },
            },
          },
        }),
        prisma.communityTemplate.count({ where }),
      ]);

      // Check user interactions if authenticated
      const userInteractions: Record<
        string,
        { liked: boolean; saved: boolean }
      > = {};

      if (ctx.session?.user?.id) {
        const templateIds = templates.map((t) => t.id);

        const [likes, saves] = await Promise.all([
          prisma.templateLike.findMany({
            where: {
              userId: ctx.session.user.id,
              templateId: { in: templateIds },
            },
            select: { templateId: true },
          }),
          prisma.templateSave.findMany({
            where: {
              userId: ctx.session.user.id,
              templateId: { in: templateIds },
            },
            select: { templateId: true },
          }),
        ]);

        const likedIds = new Set(likes.map((l) => l.templateId));
        const savedIds = new Set(saves.map((s) => s.templateId));

        templateIds.forEach((id) => {
          userInteractions[id] = {
            liked: likedIds.has(id),
            saved: savedIds.has(id),
          };
        });
      }

      return {
        templates: templates.map((template) => ({
          ...template,
          likeCount: template._count.likes,
          commentCount: template._count.comments,
          saveCount: template._count.saves,
          remixCount: template._count.remixes + template.remixCount,
          userLiked: userInteractions[template.id]?.liked || false,
          userSaved: userInteractions[template.id]?.saved || false,
        })),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit,
        },
      };
    }),

  /**
   * Get template by ID with full details
   */
  getById: baseProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { templateId } = input;

      const template = await prisma.communityTemplate.findUnique({
        where: { id: templateId },
        include: {
          category: true,
          author: {
            select: {
              id: true,
              name: true,
              image: true,
              email: true,
            },
          },
          sourceFragment: {
            select: {
              id: true,
              title: true,
              files: true,
              createdAt: true,
            },
          },
          sourceProject: {
            select: {
              id: true,
              name: true,
              subtitle: true,
              sandboxUrl: true,
              deploymentUrl: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              saves: true,
              remixes: true,
            },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Check visibility
      if (!template.published) {
        const userId = ctx.session?.user?.id;
        let canView = false;

        if (userId) {
          // Check if author
          if (template.authorId === userId) {
            canView = true;
          } else {
            // Check if admin
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { role: true },
            });
            if (user?.role === "ADMIN") {
              canView = true;
            }
          }
        }

        if (!canView) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Template not found",
          });
        }
      }

      // Check user's interaction status if authenticated
      let userLiked = false;
      let userSaved = false;
      let userPurchased = false;

      if (ctx.session?.user?.id) {
        const [like, save, purchase] = await Promise.all([
          prisma.templateLike.findUnique({
            where: {
              templateId_userId: {
                templateId,
                userId: ctx.session.user.id,
              },
            },
          }),
          prisma.templateSave.findUnique({
            where: {
              templateId_userId: {
                templateId,
                userId: ctx.session.user.id,
              },
            },
          }),
          prisma.templatePurchase.findUnique({
            where: {
              templateId_userId: {
                templateId,
                userId: ctx.session.user.id,
              },
            },
          }),
        ]);

        userLiked = !!like;
        userSaved = !!save;
        userPurchased = !!purchase;

        // Increment view count asynchronously (don't wait)
        prisma.communityTemplate
          .update({
            where: { id: templateId },
            data: { viewCount: { increment: 1 } },
          })
          .catch((err) =>
            console.error("Failed to increment view count:", err),
          );
      }

      // Get related templates (same category, exclude current)
      const relatedTemplates = await prisma.communityTemplate.findMany({
        where: {
          published: true,
          categoryId: template.categoryId,
          id: { not: templateId },
        },
        take: 4,
        orderBy: { remixCount: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          logo: true,
          thumbnailUrl: true,
          remixCount: true,
        },
      });

      return {
        ...template,
        likeCount: template._count.likes,
        commentCount: template._count.comments,
        saveCount: template._count.saves,
        remixCount: template._count.remixes + template.remixCount,
        userLiked,
        userSaved,
        userPurchased,
        relatedTemplates,
      };
    }),

  /**
   * Search templates
   */
  search: baseProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).default(12),
        offset: z.number().min(0).default(0),
        filters: z
          .object({
            categories: z.array(z.string()).optional(),
            tags: z.array(z.string()).optional(),
            featured: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const { query, limit, offset, filters } = input;

      // Build where clause
      const where: any = {
        published: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { shortDescription: { contains: query, mode: "insensitive" } },
        ],
      };

      if (filters?.categories && filters.categories.length > 0) {
        where.category = { slug: { in: filters.categories } };
      }

      if (filters?.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      if (filters?.featured !== undefined) {
        where.featured = filters.featured;
      }

      const [templates, totalCount] = await Promise.all([
        prisma.communityTemplate.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: [{ remixCount: "desc" }, { createdAt: "desc" }],
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            sourceProject: {
              select: {
                id: true,
                sandboxUrl: true,
                deploymentUrl: true,
              },
            },
            _count: {
              select: {
                likes: true,
                comments: true,
                saves: true,
                remixes: true,
              },
            },
          },
        }),
        prisma.communityTemplate.count({ where }),
      ]);

      return {
        templates: templates.map((template) => ({
          ...template,
          likeCount: template._count.likes,
          commentCount: template._count.comments,
          saveCount: template._count.saves,
          remixCount: template._count.remixes + template.remixCount,
        })),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit,
        },
      };
    }),

  /**
   * Get trending templates
   */
  getTrending: baseProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(20).default(6),
        timeframe: z.enum(["day", "week", "month"]).default("week"),
      }),
    )
    .query(async ({ input }) => {
      const { limit, timeframe } = input;

      // Calculate date threshold
      const now = new Date();
      const timeThresholds = {
        day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      };

      const threshold = timeThresholds[timeframe];

      // Calculate trending based on recent remix activity within the timeframe
      // Get templates with remixes in the timeframe, ordered by recent activity
      const recentRemixes = await prisma.templateRemix.findMany({
        where: {
          createdAt: { gte: threshold },
        },
        select: {
          templateId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Count recent remixes per template
      const recentRemixCounts = new Map<string, number>();
      recentRemixes.forEach((remix) => {
        recentRemixCounts.set(
          remix.templateId,
          (recentRemixCounts.get(remix.templateId) || 0) + 1,
        );
      });

      // Get all published templates
      const allTemplates = await prisma.communityTemplate.findMany({
        where: {
          published: true,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          author: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
              saves: true,
              remixes: true,
            },
          },
        },
      });

      // Sort by recent remix activity, then by total remix count, then by view count
      const sortedTemplates = allTemplates
        .map((template) => ({
          ...template,
          recentRemixCount: recentRemixCounts.get(template.id) || 0,
        }))
        .sort((a, b) => {
          // First sort by recent remix count (trending activity)
          if (b.recentRemixCount !== a.recentRemixCount) {
            return b.recentRemixCount - a.recentRemixCount;
          }
          // Then by total remix count
          const aTotalRemixes = a._count.remixes + a.remixCount;
          const bTotalRemixes = b._count.remixes + b.remixCount;
          if (bTotalRemixes !== aTotalRemixes) {
            return bTotalRemixes - aTotalRemixes;
          }
          // Finally by view count
          return b.viewCount - a.viewCount;
        })
        .slice(0, limit);

      return {
        templates: sortedTemplates.map((template) => {
          // Remove the temporary recentRemixCount property
          const { recentRemixCount, ...templateData } = template;
          return {
            ...templateData,
            likeCount: template._count.likes,
            commentCount: template._count.comments,
            saveCount: template._count.saves,
            remixCount: template._count.remixes + template.remixCount,
          };
        }),
      };
    }),

  // ============================================
  // TEMPLATE METADATA
  // ============================================

  /**
   * Get all categories with template counts
   */
  getCategories: baseProcedure.query(async () => {
    const categories = await prisma.templateCategory.findMany({
      orderBy: { order: "asc" },
      include: {
        _count: {
          select: {
            templates: {
              where: { published: true },
            },
          },
        },
      },
    });

    return {
      categories: categories.map((cat) => ({
        ...cat,
        templateCount: cat._count.templates,
      })),
    };
  }),

  /**
   * Get template statistics
   */
  getStats: baseProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { templateId } = input;

      const template = await prisma.communityTemplate.findUnique({
        where: { id: templateId },
        select: {
          remixCount: true,
          viewCount: true,
          saveCount: true,
          published: true,
          authorId: true,
          _count: {
            select: {
              likes: true,
              comments: true,
              saves: true,
              remixes: true,
            },
          },
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Check visibility
      if (!template.published) {
        const userId = ctx.session?.user?.id;
        let canView = false;

        if (userId) {
          // Check if author
          if (template.authorId === userId) {
            canView = true;
          } else {
            // Check if admin
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { role: true },
            });
            if (user?.role === "ADMIN") {
              canView = true;
            }
          }
        }

        if (!canView) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Template not found",
          });
        }
      }

      return {
        remixes: template._count.remixes + template.remixCount,
        likes: template._count.likes,
        comments: template._count.comments,
        saves: template._count.saves + template.saveCount,
        views: template.viewCount,
      };
    }),

  // ============================================
  // REMIX FLOW (Protected)
  // ============================================

  /**
   * Remix a template into user's workspace
   */
  remix: protectedProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
        customName: z.string().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { templateId, customName } = input;
      const userId = ctx.user.id;

      // Step 1: Fetch template with source fragment
      const template = await prisma.communityTemplate.findUnique({
        where: { id: templateId },
        include: {
          sourceFragment: true,
          category: true,
        },
      });

      if (!template || !template.published) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found or not available",
        });
      }

      // Step 2: Check if template is paid and calculate total cost
      let totalCost = REMIX_OPERATION_COST;
      let needsPurchase = false;

      if (template.price && template.price > 0) {
        // Check if user already purchased
        const purchased = await prisma.templatePurchase.findUnique({
          where: {
            templateId_userId: {
              templateId,
              userId,
            },
          },
        });

        if (!purchased) {
          needsPurchase = true;
          totalCost += template.price;
        }
      }

      // Step 3: Check affordability (without deducting) - fail early if insufficient credits
      const affordability = await CreditManager.canAffordOperation(
        userId,
        totalCost,
      );

      if (!affordability.canAfford) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message: `Insufficient credits to remix this template. You need ${totalCost} credits (${REMIX_OPERATION_COST} for remix operation${needsPurchase ? ` + ${template.price} for template purchase` : ""}). ${affordability.reason}`,
        });
      }

      // Step 4: Get user's personal team
      const personalTeam = await getOrCreatePersonalTeam(userId);

      // Step 5: Generate unique project name
      const baseName = customName || `${template.name} (Remix)`;
      const projectName = await generateUniqueProjectName(baseName);

      // Step 6: Create project + fragment in transaction
      // Increase timeout to handle large fragment files (default is 5000ms)
      const result = await prisma.$transaction(
        async (tx) => {
          // Create project first (without activeFragmentId)
          const newProject = await tx.project.create({
            data: {
              name: projectName,
              subtitle: template.shortDescription || template.description,
              logo: template.logo,
              teamId: personalTeam.id,
              userId: userId,
              messagingVersion: 2,
              buildStatus: "READY", // Template is already ready
            },
          });

          // Create fragment with projectId
          const newFragment = await tx.v2Fragment.create({
            data: {
              title: `${template.name} - Initial version`,
              files: template.sourceFragment.files as any, // Cast from JsonValue to InputJsonValue
              projectId: newProject.id,
            },
          });

          // Update project with activeFragmentId
          await tx.project.update({
            where: { id: newProject.id },
            data: { activeFragmentId: newFragment.id },
          });

          // Copy template chat messages to new project (if chat history is visible)
          if (template.chatHistoryVisible) {
            // Fetch template chat messages ordered by sequence
            const templateChatMessages = await tx.templateChatMessage.findMany({
              where: { templateId: template.id },
              orderBy: { order: "asc" },
            });

            // Create V2Messages for the new project
            if (templateChatMessages.length > 0) {
              await tx.v2Message.createMany({
                data: templateChatMessages.map((msg) => ({
                  projectId: newProject.id,
                  role: msg.role.toUpperCase(), // Ensure role is uppercase (USER/ASSISTANT/SYSTEM)
                  // V2Message.content expects JSON-stringified message parts
                  // Wrap plain text content in the AI SDK message parts format
                  content: JSON.stringify([
                    {
                      type: "text",
                      text: msg.content,
                    },
                  ]),
                  createdAt: new Date(new Date().getTime() + msg.order * 1000), // Preserve order with timestamps
                })),
              });
            }
          }

          // Create remix tracking record
          await tx.templateRemix.create({
            data: {
              templateId: template.id,
              userId: userId,
              remixedProjectId: newProject.id,
            },
          });

          // Increment template remix count
          await tx.communityTemplate.update({
            where: { id: template.id },
            data: { remixCount: { increment: 1 } },
          });

          return { project: newProject, fragment: newFragment };
        },
        {
          maxWait: 10000, // Wait up to 10 seconds to acquire transaction
          timeout: 30000, // Transaction can run for up to 30 seconds
        },
      );

      // Step 7: Initialize sandbox with fragment files
      // This ensures the preview and code view are available immediately
      // Ensure sandbox provider is set
      const currentProvider = await getSandboxProvider(result.project.id);
      if (!currentProvider) {
        await setSandboxProvider(result.project.id, getDefaultProvider());
      }

      // Create sandbox with the fragment
      // This will restore the fragment files into the sandbox
      // Use default template as base, then restore fragment files
      // If this fails, the entire remix operation will fail with a clear error
      const sandboxInfo = await createSandbox(
        result.project.id,
        result.fragment.id,
        "database-vite-template", // Use default template as base image
      );

      // Verify the project was updated with sandbox info
      const updatedProject = await prisma.project.findUnique({
        where: { id: result.project.id },
        select: {
          sandboxId: true,
          sandboxUrl: true,
          activeFragmentId: true,
        },
      });

      if (!updatedProject?.sandboxId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Sandbox was created but project was not updated. Please try again.",
        });
      }

      // Step 8: Deduct credits now that all operations have succeeded
      // This ensures users are only charged for successful remix operations
      try {
        // Deduct base remix operation cost
        await CreditManager.deductCredits(
          userId,
          REMIX_OPERATION_COST,
          "AI_GENERATION",
          `Remix operation: ${template.name}`,
          {
            templateId: template.id,
            operation: "template_remix",
            templateName: template.name,
          },
        );

        // If template purchase is needed, deduct purchase cost and create purchase record
        if (needsPurchase && template.price && template.price > 0) {
          await CreditManager.deductCredits(
            userId,
            template.price,
            "AI_GENERATION",
            `Purchased template: ${template.name}`,
            {
              templateId: template.id,
              operation: "template_purchase",
              templateName: template.name,
              price: template.price,
            },
          );

          // Create purchase record
          await prisma.templatePurchase.create({
            data: {
              templateId,
              userId,
              priceAtPurchase: template.price,
            },
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Remix operation completed but credit deduction failed. Please contact support. ${errorMessage}`,
        });
      }

      // Step 9: Return project info for redirect
      return {
        projectId: result.project.id,
        projectName: result.project.name,
        redirectUrl: `/projects/${result.project.id}`,
      };
    }),

  // ============================================
  // SOCIAL ACTIONS (Protected)
  // ============================================

  /**
   * Like/unlike a template (toggle)
   */
  like: protectedProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { templateId } = input;
      const userId = ctx.user.id;

      // Check if already liked
      const existingLike = await prisma.templateLike.findUnique({
        where: {
          templateId_userId: {
            templateId,
            userId,
          },
        },
      });

      let liked: boolean;

      if (existingLike) {
        // Unlike
        await prisma.templateLike.delete({
          where: { id: existingLike.id },
        });
        liked = false;
      } else {
        // Like
        await prisma.templateLike.create({
          data: {
            templateId,
            userId,
          },
        });
        liked = true;
      }

      // Get new like count
      const likeCount = await prisma.templateLike.count({
        where: { templateId },
      });

      return {
        liked,
        likeCount,
      };
    }),

  /**
   * Add a comment to a template
   */
  comment: protectedProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
        content: z.string().min(1).max(2000),
        parentId: z.string().cuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { templateId, content, parentId } = input;
      const userId = ctx.user.id;

      // Verify template exists
      const template = await prisma.communityTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Create comment
      const comment = await prisma.templateComment.create({
        data: {
          templateId,
          userId,
          content,
          parentId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      return {
        comment,
      };
    }),

  /**
   * Delete a comment
   */
  deleteComment: protectedProcedure
    .input(
      z.object({
        commentId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { commentId } = input;
      const userId = ctx.user.id;

      // Get comment
      const comment = await prisma.templateComment.findUnique({
        where: { id: commentId },
        select: { userId: true },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check if user owns comment or is admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (comment.userId !== userId && user?.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete your own comments",
        });
      }

      // Delete comment
      await prisma.templateComment.delete({
        where: { id: commentId },
      });

      return {
        success: true,
      };
    }),

  /**
   * Get comments for a template
   */
  getComments: baseProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const { templateId, limit, offset } = input;

      const [comments, totalCount] = await Promise.all([
        prisma.templateComment.findMany({
          where: {
            templateId,
            parentId: null, // Only top-level comments
          },
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        }),
        prisma.templateComment.count({
          where: { templateId, parentId: null },
        }),
      ]);

      return {
        comments,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit,
        },
      };
    }),

  /**
   * Save/unsave a template (toggle bookmark)
   */
  save: protectedProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { templateId } = input;
      const userId = ctx.user.id;

      // Check if already saved
      const existingSave = await prisma.templateSave.findUnique({
        where: {
          templateId_userId: {
            templateId,
            userId,
          },
        },
      });

      let saved: boolean;

      if (existingSave) {
        // Unsave
        await prisma.$transaction([
          prisma.templateSave.delete({
            where: { id: existingSave.id },
          }),
          prisma.communityTemplate.update({
            where: { id: templateId },
            data: { saveCount: { decrement: 1 } },
          }),
        ]);
        saved = false;
      } else {
        // Save
        await prisma.$transaction([
          prisma.templateSave.create({
            data: {
              templateId,
              userId,
            },
          }),
          prisma.communityTemplate.update({
            where: { id: templateId },
            data: { saveCount: { increment: 1 } },
          }),
        ]);
        saved = true;
      }

      // Get new save count
      const saveCount = await prisma.communityTemplate.findUnique({
        where: { id: templateId },
        select: { saveCount: true },
      });

      return {
        saved,
        saveCount: saveCount?.saveCount || 0,
      };
    }),

  /**
   * Get user's saved templates
   */
  getMySavedTemplates: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(12),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset } = input;
      const userId = ctx.user.id;

      const [saves, totalCount] = await Promise.all([
        prisma.templateSave.findMany({
          where: { userId },
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
          include: {
            template: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    icon: true,
                  },
                },
                author: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
                _count: {
                  select: {
                    likes: true,
                    comments: true,
                    saves: true,
                    remixes: true,
                  },
                },
              },
            },
          },
        }),
        prisma.templateSave.count({ where: { userId } }),
      ]);

      return {
        templates: saves.map((save) => ({
          ...save.template,
          likeCount: save.template._count.likes,
          commentCount: save.template._count.comments,
          saveCount: save.template._count.saves,
          remixCount: save.template._count.remixes + save.template.remixCount,
          savedAt: save.createdAt,
          userSaved: true,
        })),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit,
        },
      };
    }),

  // ============================================
  // CHAT HISTORY (Public)
  // ============================================

  /**
   * Get chat history (recipe) for a template
   */
  getChatHistory: baseProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { templateId } = input;

      // Fetch template
      const template = await prisma.communityTemplate.findUnique({
        where: { id: templateId },
        select: {
          chatHistoryVisible: true,
          seedPrompt: true,
          published: true,
          authorId: true,
        },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template not found",
        });
      }

      // Check visibility
      if (!template.published) {
        const userId = ctx.session?.user?.id;
        let canView = false;

        if (userId) {
          // Check if author
          if (template.authorId === userId) {
            canView = true;
          } else {
            // Check if admin
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { role: true },
            });
            if (user?.role === "ADMIN") {
              canView = true;
            }
          }
        }

        if (!canView) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Template not found",
          });
        }
      }

      // Fetch chat messages (check if any exist for backward compatibility)
      const messages = await prisma.templateChatMessage.findMany({
        where: { templateId },
        orderBy: { order: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          order: true,
          createdAt: true,
        },
      });

      // If chatHistoryVisible is false but we have messages or seedPrompt,
      // return them anyway for backward compatibility with older templates
      if (
        !template.chatHistoryVisible &&
        messages.length === 0 &&
        !template.seedPrompt
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Chat history is not available for this template",
        });
      }

      return {
        seedPrompt: template.seedPrompt,
        messages,
      };
    }),

  // ============================================
  // ADMIN ENDPOINTS (Protected - Admin Only)
  // ============================================

  /**
   * Create a template from a project
   */
  create: adminProcedure
    .input(
      z.object({
        sourceProjectId: z.string().uuid(),
        sourceFragmentId: z.string().uuid(),
        name: z.string().min(1).max(100),
        description: z.string().min(1),
        shortDescription: z.string().min(1).max(200),
        categoryId: z.string().cuid(),
        tags: z.array(z.string()),
        thumbnailUrl: z.string().url().optional(),
        featured: z.boolean().default(false),
        published: z.boolean().default(true),
        includeChatHistory: z.boolean().default(true),
        price: z.number().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const {
        sourceProjectId,
        sourceFragmentId,
        name,
        description,
        shortDescription,
        categoryId,
        tags,
        thumbnailUrl,
        featured,
        published,
        includeChatHistory,
        price,
      } = input;

      // Verify project exists and get the original creator
      const project = await prisma.project.findUnique({
        where: { id: sourceProjectId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          team: {
            include: {
              members: {
                where: { role: "OWNER" },
                take: 1,
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          v2Messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Get the original project creator
      // Priority: 1. userId (legacy personal project), 2. Team owner (team project)
      let originalAuthor = project.user;
      if (!originalAuthor && project.team?.members?.[0]?.user) {
        originalAuthor = project.team.members[0].user;
      }

      const authorName =
        originalAuthor?.name || originalAuthor?.email || "Unknown User";
      const authorId = originalAuthor?.id || null;

      // Verify fragment exists
      const fragment = await prisma.v2Fragment.findUnique({
        where: { id: sourceFragmentId },
      });

      if (!fragment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fragment not found",
        });
      }

      // Helper function to extract text from JSON content
      const extractTextFromContent = (content: string): string => {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            // Extract text from parts array
            return parsed
              .filter((part: any) => part.type === "text" && part.text)
              .map((part: any) => part.text)
              .join("\n\n");
          }
          // If it's already a string, return it
          if (typeof parsed === "string") {
            return parsed;
          }
          // Fallback: return the original content
          return content;
        } catch {
          // If parsing fails, assume it's plain text
          return content;
        }
      };

      // Find the first user message for seedPrompt
      // V2Message uses "USER" (uppercase) for user messages
      const firstUserMessage = project.v2Messages.find(
        (msg) => msg.role.toUpperCase() === "USER",
      );
      const seedPrompt = firstUserMessage
        ? extractTextFromContent(firstUserMessage.content)
        : null;

      // Generate slug
      let slug = generateTemplateSlug(name);
      let attempts = 0;
      while (attempts < 10) {
        const existing = await prisma.communityTemplate.findUnique({
          where: { slug },
        });
        if (!existing) break;
        slug = `${generateTemplateSlug(name)}-${nanoid(6)}`;
        attempts++;
      }

      // Determine if we should show chat history
      // Show it if requested AND we have messages to show
      const hasMessages = project.v2Messages.length > 0;
      const shouldShowChatHistory = includeChatHistory && hasMessages;

      // Create template
      const template = await prisma.communityTemplate.create({
        data: {
          name,
          slug,
          description,
          shortDescription,
          logo: project.logo || "📦",
          thumbnailUrl,
          sourceProjectId,
          sourceFragmentId,
          categoryId,
          tags,
          featured,
          published,
          chatHistoryVisible: shouldShowChatHistory,
          seedPrompt,
          authorId, // Set to the original project creator
          authorName, // Set to the original project creator's name
          price,
        },
      });

      // Copy chat messages if requested and available
      if (shouldShowChatHistory) {
        const chatMessages = project.v2Messages
          .map((msg, index) => {
            const extractedContent = extractTextFromContent(msg.content);
            // Skip empty messages
            if (!extractedContent || extractedContent.trim().length === 0) {
              return null;
            }
            // Map role: V2Message uses "USER"/"ASSISTANT" (uppercase), TemplateChatMessage uses "user"/"assistant" (lowercase)
            const normalizedRole = msg.role.toUpperCase();
            const templateRole =
              normalizedRole === "USER" ? "user" : "assistant";
            return {
              templateId: template.id,
              role: templateRole,
              content: extractedContent,
              order: index,
            };
          })
          .filter((msg): msg is NonNullable<typeof msg> => msg !== null);

        if (chatMessages.length > 0) {
          await prisma.templateChatMessage.createMany({
            data: chatMessages,
          });
        }
      }

      return {
        template,
      };
    }),

  /**
   * Update a template
   */
  update: adminProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().min(1).optional(),
        shortDescription: z.string().min(1).max(200).optional(),
        categoryId: z.string().cuid().optional(),
        tags: z.array(z.string()).optional(),
        thumbnailUrl: z.string().url().optional(),
        featured: z.boolean().optional(),
        published: z.boolean().optional(),
        price: z.number().min(0).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { templateId, ...updateData } = input;

      const template = await prisma.communityTemplate.update({
        where: { id: templateId },
        data: updateData,
      });

      return {
        template,
      };
    }),

  /**
   * Delete a template
   */
  delete: adminProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const { templateId } = input;

      await prisma.communityTemplate.delete({
        where: { id: templateId },
      });

      return {
        success: true,
      };
    }),

  /**
   * Toggle featured status
   */
  setFeatured: adminProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
        featured: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const { templateId, featured } = input;

      const template = await prisma.communityTemplate.update({
        where: { id: templateId },
        data: { featured },
      });

      return {
        template,
      };
    }),

  /**
   * Toggle published status
   */
  setPublished: adminProcedure
    .input(
      z.object({
        templateId: z.string().cuid(),
        published: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const { templateId, published } = input;

      const template = await prisma.communityTemplate.update({
        where: { id: templateId },
        data: { published },
      });

      return {
        template,
      };
    }),

  /**
   * Get all templates (admin view)
   */
  getAllAdmin: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        filter: z
          .enum(["all", "published", "unpublished", "featured"])
          .default("all"),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { limit, offset, filter, search } = input;

      const where: any = {};
      if (filter === "published") where.published = true;
      if (filter === "unpublished") where.published = false;
      if (filter === "featured") where.featured = true;

      // Add search functionality
      if (search && search.trim()) {
        where.OR = [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            shortDescription: {
              contains: search,
              mode: "insensitive",
            },
          },
        ];
      }

      const [templates, totalCount] = await Promise.all([
        prisma.communityTemplate.findMany({
          where,
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
          include: {
            category: true,
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            _count: {
              select: {
                likes: true,
                comments: true,
                saves: true,
                remixes: true,
              },
            },
          },
        }),
        prisma.communityTemplate.count({ where }),
      ]);

      return {
        templates: templates.map((template) => ({
          ...template,
          likeCount: template._count.likes,
          commentCount: template._count.comments,
          saveCount: template._count.saves,
          remixCount: template._count.remixes + template.remixCount,
        })),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: totalCount > offset + limit,
        },
      };
    }),
});
