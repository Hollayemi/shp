import { protectedProcedure, adminProcedure, createTRPCRouter } from "@/trpc/init";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

// Helper function to generate unique slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substring(2, 8);
}

// Helper function to check team permissions
async function checkTeamPermission(
  teamId: string, 
  userId: string, 
  requiredRoles: string[]
): Promise<boolean> {
  const membership = await prisma.teamMember.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId
      }
    }
  });

  return membership ? requiredRoles.includes(membership.role) : false;
}

export const teamsRouter = createTRPCRouter({
  // Get user's teams
  getMyTeams: protectedProcedure.query(async ({ ctx }) => {
    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: ctx.user.id
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        _count: {
          select: {
            projects: true,
            members: true
          }
        }
      },
      orderBy: [
        { isPersonal: 'desc' }, // Personal teams first
        { createdAt: 'asc' }
      ]
    });

    return teams.map(team => ({
      ...team,
      myRole: team.members.find(m => m.userId === ctx.user.id)?.role || 'VIEWER'
    }));
  }),

  // Get single team details
  getTeam: protectedProcedure
    .input(z.object({
      teamId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      // Check if user is team member
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: ctx.user.id,
            teamId: input.teamId
          }
        }
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found or access denied"
        });
      }

      const team = await prisma.team.findUnique({
        where: { id: input.teamId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              }
            },
            orderBy: [
              { role: 'asc' }, // OWNER first
              { joinedAt: 'asc' }
            ]
          },
          projects: {
            orderBy: { updatedAt: 'desc' },
            include: {
              _count: {
                select: { messages: true }
              }
            }
          }
        }
      });

      if (!team) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team not found"
        });
      }

      return {
        ...team,
        myRole: membership.role
      };
    }),

  // Create new team
  createTeam: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      description: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const slug = generateSlug(input.name);

      const team = await prisma.team.create({
        data: {
          name: input.name,
          description: input.description,
          slug,
          isPersonal: false,
          members: {
            create: {
              userId: ctx.user.id,
              role: 'OWNER'
            }
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              }
            }
          }
        }
      });

      return team;
    }),

  // Update team
  updateTeam: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      name: z.string().min(1).max(50).optional(),
      description: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user can edit team (OWNER or ADMIN)
      const canEdit = await checkTeamPermission(
        input.teamId, 
        ctx.user.id, 
        ['OWNER', 'ADMIN']
      );

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this team"
        });
      }

      const team = await prisma.team.update({
        where: { id: input.teamId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.description !== undefined && { description: input.description })
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true
                }
              }
            }
          }
        }
      });

      return team;
    }),

  // Delete team
  deleteTeam: protectedProcedure
    .input(z.object({
      teamId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Only team owners can delete teams
      const canDelete = await checkTeamPermission(
        input.teamId, 
        ctx.user.id, 
        ['OWNER']
      );

      if (!canDelete) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only team owners can delete teams"
        });
      }

      // Check if it's a personal team
      const team = await prisma.team.findUnique({
        where: { id: input.teamId }
      });

      if (team?.isPersonal) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete personal teams"
        });
      }

      await prisma.team.delete({
        where: { id: input.teamId }
      });

      return { success: true };
    }),

  // Invite user to team
  inviteUser: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      email: z.string().email(),
      role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER')
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user can invite (OWNER or ADMIN)
      const canInvite = await checkTeamPermission(
        input.teamId, 
        ctx.user.id, 
        ['OWNER', 'ADMIN']
      );

      if (!canInvite) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to invite users"
        });
      }

      // Find user by email
      const userToInvite = await prisma.user.findUnique({
        where: { email: input.email }
      });

      if (!userToInvite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found"
        });
      }

      // Check if user is already a member
      const existingMember = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: userToInvite.id,
            teamId: input.teamId
          }
        }
      });

      if (existingMember) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is already a team member"
        });
      }

      const member = await prisma.teamMember.create({
        data: {
          userId: userToInvite.id,
          teamId: input.teamId,
          role: input.role
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          }
        }
      });

      return member;
    }),

  // Update member role
  updateMemberRole: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      userId: z.string(),
      role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user can manage members (OWNER or ADMIN)
      const canManage = await checkTeamPermission(
        input.teamId, 
        ctx.user.id, 
        ['OWNER', 'ADMIN']
      );

      if (!canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to manage members"
        });
      }

      // Don't allow changing your own role from OWNER if you're the only owner
      if (input.userId === ctx.user.id && input.role !== 'OWNER') {
        const ownerCount = await prisma.teamMember.count({
          where: {
            teamId: input.teamId,
            role: 'OWNER'
          }
        });

        if (ownerCount === 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last owner from the team"
          });
        }
      }

      const member = await prisma.teamMember.update({
        where: {
          userId_teamId: {
            userId: input.userId,
            teamId: input.teamId
          }
        },
        data: { role: input.role },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          }
        }
      });

      return member;
    }),

  // Remove member from team
  removeMember: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      userId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if user can manage members (OWNER or ADMIN)
      const canManage = await checkTeamPermission(
        input.teamId, 
        ctx.user.id, 
        ['OWNER', 'ADMIN']
      );

      if (!canManage) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to remove members"
        });
      }

      // Don't allow removing the last owner
      const memberToRemove = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: input.userId,
            teamId: input.teamId
          }
        }
      });

      if (memberToRemove?.role === 'OWNER') {
        const ownerCount = await prisma.teamMember.count({
          where: {
            teamId: input.teamId,
            role: 'OWNER'
          }
        });

        if (ownerCount === 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last owner from the team"
          });
        }
      }

      await prisma.teamMember.delete({
        where: {
          userId_teamId: {
            userId: input.userId,
            teamId: input.teamId
          }
        }
      });

      return { success: true };
    }),

  // Leave team
  leaveTeam: protectedProcedure
    .input(z.object({
      teamId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId: ctx.user.id,
            teamId: input.teamId
          }
        }
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "You are not a member of this team"
        });
      }

      // Check if it's a personal team
      const team = await prisma.team.findUnique({
        where: { id: input.teamId }
      });

      if (team?.isPersonal) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot leave personal teams"
        });
      }

      // Don't allow the last owner to leave
      if (membership.role === 'OWNER') {
        const ownerCount = await prisma.teamMember.count({
          where: {
            teamId: input.teamId,
            role: 'OWNER'
          }
        });

        if (ownerCount === 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Transfer ownership before leaving the team"
          });
        }
      }

      await prisma.teamMember.delete({
        where: {
          userId_teamId: {
            userId: ctx.user.id,
            teamId: input.teamId
          }
        }
      });

      return { success: true };
    })
}); 