import { prisma } from "@/lib/db";

export async function checkProjectAccess(
    projectId: string, 
    userId: string, 
    requiredRoles: string[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']
  ): Promise<boolean> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: true }
    });
  
    if (!project) return false;
  
    // Check legacy personal projects
    if (project.userId === userId) return true;
  
    // Check team access
    if (project.teamId) {
      const membership = await prisma.teamMember.findUnique({
        where: {
          userId_teamId: {
            userId,
            teamId: project.teamId
          }
        }
      });
  
      return membership ? requiredRoles.includes(membership.role) : false;
    }
  
    return false;
  }
  
  