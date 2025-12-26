import { redirect } from "next/navigation";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createCallerFactory, createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";
import type { Session } from "next-auth";

const projectDescriptionSchema = z
  .string()
  .min(5, "Project description must be at least 5 characters long")
  .max(1000, "Project description must be less than 1000 characters")
  .refine((value) => value.trim().length > 0, "Project description cannot be empty");

interface WebflowRedirectParams {
  name?: string | string[];
  error?: string | string[];
}

type RedirectAction = {
  type: 'success';
  projectId: string;
  description: string;
} | {
  type: 'error';
  errorType: 'unauthorized' | 'payment_required' | 'creation_failed' | 'unknown_error';
  description?: string;
} | {
  type: 'auth_required';
  description: string;
};

/**
 * Handles Webflow redirect logic for project creation
 * @param params - Search parameters from the URL
 * @param session - User session object
 * @returns void (handles redirects internally)
 */
export async function handleWebflowRedirect(
  params: WebflowRedirectParams,
  session: Session | null
): Promise<void> {
  if (!params.name || typeof params.name !== 'string' || params.error) {
    return;
  }

  const projectDescription = params.name;

  // Validate project description
  const validationResult = projectDescriptionSchema.safeParse(projectDescription);
  if (!validationResult.success) {
    redirect(`/?error=invalid_description`);
  }

  // Check authentication - redirect with auth_required error
  if (!session?.user?.id) {
    redirect(`/?name=${encodeURIComponent(projectDescription)}&error=auth_required`);
  }

  let redirectAction: RedirectAction | null = null;

  // Try to create project using tRPC
  try {
    const ctx = await createTRPCContext();
    const caller = createCallerFactory(appRouter)(ctx);
    
    const project = await caller.projects.create({
      value: projectDescription,
    });

    // Set success redirect action
    redirectAction = {
      type: 'success',
      projectId: project.id,
      description: projectDescription
    };

  } catch (error) {

    // Set error redirect action based on error type
    if (error instanceof TRPCError) {
      switch (error.code) {
        case "UNAUTHORIZED":
          redirectAction = { type: 'error', errorType: 'unauthorized' };
          break;
        
        case "PAYMENT_REQUIRED":
          redirectAction = { 
            type: 'error', 
            errorType: 'payment_required', 
            description: projectDescription 
          };
          break;
        
        default:
          redirectAction = { 
            type: 'error', 
            errorType: 'creation_failed', 
            description: projectDescription 
          };
      }
    } else {
      // Generic error fallback
      redirectAction = { 
        type: 'error', 
        errorType: 'unknown_error', 
        description: projectDescription 
      };
    }
  } finally {
    if (redirectAction) {
      if (redirectAction.type === 'success') {
        redirect(`/projects/${redirectAction.projectId}?seed=${encodeURIComponent(redirectAction.description)}`);
      } else {
        // Handle error redirects
        switch (redirectAction.errorType) {
          case 'unauthorized':
            redirect(`/?name=${encodeURIComponent(redirectAction.description || projectDescription)}&error=auth_required`);
            
          case 'payment_required':
            redirect(`/?name=${encodeURIComponent(redirectAction.description!)}&error=insufficient_credits`);
            
          case 'creation_failed':
            redirect(`/?name=${encodeURIComponent(redirectAction.description!)}&error=creation_failed`);
            
          case 'unknown_error':
          default:
            redirect(`/?name=${encodeURIComponent(redirectAction.description!)}&error=unknown_error`);
        }
      }
    }
  }

}