"use client";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  showInsufficientCreditsToast,
  showNeedPaidPlanToast,
} from "@/components/toast-notifications";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ImageIcon } from "lucide-react";
import {
  Send,
  Coins,
  ArrowUp,
  Paintbrush,
  Sparkles,
  Square as SquareIcon,
  FolderCode,
  Link2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PromptPresets } from "@/components/PromptPresets";
import { type PromptPreset } from "@/data/prompt-presets";
import { StylingInstructionsDialog } from "@/components/StylingInstructionsDialog";
import { VoiceInput } from "@/components/VoiceInput";
import { type StylingPreset, getDisplayPrompt } from "@/data/styling-presets";
import { useRouter } from "nextjs-toploader/app";
import { CodeImportDialog } from "@/components/code-import/CodeImportDialog";
import { ImportCodeIcon } from "@/components/icons/ImportCodeIcon";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import PricingModal from "@/components/PricingModal";
import { AuthDialog } from "@/components/AuthDialog";
import { WandSparkles } from "lucide-react";
import { ShimmeringText } from "@/components/ui/shadcn-io/shimmering-text";
import {
  CharacterCounter,
  useCharacterLimit,
  CHARACTER_LIMIT,
  WARNING_THRESHOLD,
} from "@/components/CharacterCounter";
import { AgentDropdown } from "@/components/AgentDropdown";
import {
  ChatFileUpload,
  type FileAttachment,
} from "@/modules/projects/ui/components/ChatImageUpload";
import { nanoid } from "nanoid";
import { WorkspaceSettingsModal } from "@/modules/connectors/ui";

const projectSchema = z.object({
  description: z
    .string()
    .min(5, "Project description must be at least 5 characters long")
    .max(
      CHARACTER_LIMIT,
      `Project description must be less than ${CHARACTER_LIMIT} characters`,
    )
    .refine(
      (value) => value.trim().length > 0,
      "Project description cannot be empty",
    ),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface GenerativeChatInputProps {
  initialCredits?: { creditBalance: number; membershipTier?: string } | null;
  initialDescription?: string;
  embedded?: boolean;
  baseUrl?: string;
  onStyleClick?: () => void;
}

export const GenerativeChatInput = ({
  initialCredits,
  initialDescription = "",
  embedded = false,
  baseUrl = "",
  onStyleClick,
}: GenerativeChatInputProps) => {
  const trcp = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Check if user has never paid (for showing appropriate toast)
  const { data: hasNeverPaidData } = useQuery(
    trcp.credits.hasNeverPaid.queryOptions(),
  );

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isStylingDialogOpen, setIsStylingDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isConnectorsModalOpen, setIsConnectorsModalOpen] = useState(false);
  const [selectedStylingPreset, setSelectedStylingPreset] = useState<
    string | null
  >(null);
  const [baseStylingPrompt, setBaseStylingPrompt] = useState<string>("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const previousPathRef = useRef(pathname);
  const [attachedImages, setAttachedImages] = useState<FileAttachment[]>([]);
  const [presetImage, setPresetImage] = useState<string | null>(null);
  const fileInputTriggerRef = useRef<(() => void) | null>(null);

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      description: initialDescription,
    },
    mode: "onChange", // Validate as user types
  });

  // Voice input state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceFrequencyData, setVoiceFrequencyData] = useState<number[]>([]);
  const initialVoiceTextRef = useRef(""); // Store text before recording starts
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper: convert an image URL (e.g. "/pitch.png") to a base64 data URI in the browser
  const convertImageUrlToDataUri = async (imageUrl: string) => {
    try {
      if (!imageUrl) return null;

      // If it's already a data URI, just use it as-is
      if (imageUrl.startsWith("data:")) {
        return imageUrl;
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(
          "[GenerativeChatInput] Failed to fetch preset image for base64 conversion",
          {
            imageUrl,
            status: response.status,
            statusText: response.statusText,
          },
        );
        return null;
      }

      const contentType = response.headers.get("content-type") || "image/png";
      const blob = await response.blob();

      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === "string") {
            resolve(result);
          } else {
            resolve(null);
          }
        };
        reader.onerror = (error) => {
          console.error(
            "[GenerativeChatInput] FileReader error while converting preset image to base64",
            { imageUrl, error },
          );
          resolve(null);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(
        "[GenerativeChatInput] Unexpected error converting preset image to base64",
        { imageUrl, error },
      );
      return null;
    }
  };

  // Auto-resize textarea based on content
  const descriptionValue = form.watch("description");
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        textarea.style.height = "56px"; // Reset to min height

        // If empty, force min height
        if (!descriptionValue) {
          textarea.style.height = "56px";
          return;
        }

        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = Math.min(scrollHeight, 400) + "px"; // Max 400px
      });
    }
  }, [descriptionValue]);

  // Handle error messages from URL parameters and set initial description
  useEffect(() => {
    const errorParam = searchParams.get("error");
    const descriptionParam = searchParams.get("description");
    const openStylingParam = searchParams.get("openStyling");

    if (errorParam) {
      // If embedded, don't show toasts/modals - they're handled by parent page
      if (!embedded) {
        // Map error keys to user-friendly messages
        const errorMessages: Record<string, string> = {
          invalid_description:
            "Project description must be between 5-2000 characters",
          insufficient_credits:
            "Insufficient credits! Purchase credits to continue.",
          creation_failed: "Failed to create project. Please try again.",
          unknown_error: "An unexpected error occurred. Please try again.",
        };

        const errorMessage =
          errorMessages[errorParam] || decodeURIComponent(errorParam);

        // Show specific action for insufficient credits
        if (errorParam === "insufficient_credits") {
          // Check if user is a free user who never paid
          const isFreeUser = hasNeverPaidData?.hasNeverPaid ?? false;
          if (isFreeUser) {
            showNeedPaidPlanToast({
              onUpgrade: () => setIsPricingModalOpen(true),
            });
          } else {
            showInsufficientCreditsToast({
              onUpgrade: () => setIsPricingModalOpen(true),
            });
          }
        } else if (errorParam === "auth_required") {
          setShowAuthPopup(true);
        } else {
          toast.error(errorMessage);
        }
      }
    }

    // Set description from URL parameter or initial prop
    const descriptionToSet = descriptionParam || initialDescription;
    if (descriptionToSet) {
      form.setValue("description", descriptionToSet, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    }

    // Open styling dialog if requested from embedded mode
    if (openStylingParam === "true" && !embedded) {
      setIsStylingDialogOpen(true);
    }

    // Clean URL parameters after processing them
    if (errorParam || descriptionParam || openStylingParam) {
      // Use setTimeout to avoid triggering NextTopLoader during initial render
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        url.searchParams.delete("description");
        url.searchParams.delete("openStyling");
        window.history.replaceState({}, "", url.toString());
      }, 0);
    }
  }, [initialDescription, searchParams, form, embedded, hasNeverPaidData]);

  // Track route changes to reset form after navigation completes
  // Only for non-embedded mode (embedded uses full page redirects)
  useEffect(() => {
    if (embedded) return; // Skip for embedded mode

    // If pathname changed and we're navigating, reset the form
    if (pathname !== previousPathRef.current && isNavigating) {
      form.reset();
      setAttachedImages([]);
      setIsNavigating(false);
    }
    // Update the previous path
    previousPathRef.current = pathname;
  }, [pathname, isNavigating, form, embedded]);

  // Use server-side initial credits if available, otherwise fetch client-side
  const { data: credits, isLoading: isLoadingCredits } = useQuery({
    ...trcp.credits.getMyCredits.queryOptions(),
    enabled: !initialCredits, // Only fetch if we don't have initial data
  });



  // Use initial credits if available, otherwise use fetched data
  const currentCredits = initialCredits || credits?.user;

  // Check if user is authenticated (has credits data)
  // While loading credits, treat as authenticated to avoid flash of auth modal
  const isAuthenticated =
    !!initialCredits || isLoadingCredits || !!currentCredits;

  // Check if user is a paid user (PRO or ENTERPRISE tier)
  // While loading credits, treat as paid to avoid flash of "upgrade" message
  const isPaidUser =
    (!initialCredits && isLoadingCredits) ||
    currentCredits?.membershipTier === "PRO" ||
    currentCredits?.membershipTier === "ENTERPRISE";

  const [lastSubmittedDescription, setLastSubmittedDescription] =
    useState<string>(initialDescription);

  // Check for any pending project creation mutations globally
  const isAnyProjectCreating =
    queryClient.isMutating({
      mutationKey: trcp.projects.create.mutationKey(),
    }) > 0;
  const isAnyProjectCanceling =
    queryClient.isMutating({
      mutationKey: trcp.projects.cancelCreate.mutationKey(),
    }) > 0;
  const canceledRef = useRef(false);
  const currentCreationIdRef = useRef<string | null>(null);

  const createProject = useMutation(
    trcp.projects.create.mutationOptions({
      onSuccess: async (data) => {
        console.log("[GenerativeChatInput] ✅ Project created", {
          projectId: data.id,
          descriptionLength: lastSubmittedDescription?.length ?? 0,
          attachedFileCount: attachedImages.length,
          hasPresetImage: !!presetImage,
        });
        // If user cancelled, do not proceed with navigation or further actions
        if (canceledRef.current) {
          canceledRef.current = false;
          setIsNavigating(false);
          return;
        }
        // Project created successfully - navigate to it
        const seedParam = lastSubmittedDescription
          ? `?seed=${encodeURIComponent(lastSubmittedDescription)}`
          : "";

        // Store attached files and preset image in sessionStorage for the new project
        // Store even if only preset image is present (no other files attached)
        if (attachedImages.length > 0 || presetImage) {
          try {
            const fileData: Array<{
              url: string;
              type: string;
              name: string;
              isPreset?: boolean;
            }> = attachedImages.map((fileAttachment) => ({
              url: fileAttachment.url || "", // Use uploaded R2 URL, not local preview
              type: fileAttachment.file.type || "application/octet-stream",
              name: fileAttachment.file.name,
            }));

            // Add preset image if available
            if (presetImage) {
              console.log(
                "[GenerativeChatInput] Adding preset image to fileData:",
                presetImage,
              );
              fileData.push({
                url: presetImage,
                type: "image/png", // Assume PNG for presets or detect from URL
                name: "style-reference.png",
                isPreset: true,
              });
            }

            console.log(
              "[GenerativeChatInput] Storing files in sessionStorage:",
              {
                storageKey: `project-${data.id}-files`,
                fileCount: fileData.length,
                presetImage: !!presetImage,
                files: fileData,
              },
            );
            sessionStorage.setItem(
              `project-${data.id}-files`,
              JSON.stringify(fileData),
            );
          } catch (error) {
            console.error("Failed to store files:", error);
          }
        }

        // Set navigating state to keep form disabled during navigation
        setIsNavigating(true);

        if (embedded) {
          // For embedded mode, redirect the parent window
          const redirectUrl = `${baseUrl}/projects/${data.id}${seedParam}`;

          if (window.parent && window.parent !== window) {
            // We're in an iframe, redirect the parent
            window.parent.location.href = redirectUrl;
          } else {
            // Fallback to regular redirect
            window.location.href = redirectUrl;
          }
        } else {
          // Normal navigation for non-embedded mode
          router.push(`/projects/${data.id}${seedParam}`);
          // Form will be reset automatically when pathname changes (see useEffect above)
        }

        // Refresh credit balance in background (don't await to avoid delay)
        queryClient.invalidateQueries({
          queryKey: trcp.credits.getMyCredits.queryKey(),
        });
      },
      onError: (error) => {
        console.error("[GenerativeChatInput] ❌ Project creation failed", {
          message: error.message,
          code: (error as any)?.data?.code,
          descriptionLength: lastSubmittedDescription?.length ?? 0,
          attachedFileCount: attachedImages.length,
          hasPresetImage: !!presetImage,
        });
        // If user cancelled, swallow the error and reset state
        if (canceledRef.current) {
          canceledRef.current = false;
          setIsNavigating(false);
          return;
        }
        // Handle authentication errors
        if (error.data?.code === "UNAUTHORIZED") {
          if (embedded) {
            // For embedded mode, redirect to normal page with auth error
            const redirectUrl = `${baseUrl}/?error=auth_required&description=${encodeURIComponent(lastSubmittedDescription)}`;
            if (window.parent && window.parent !== window) {
              window.parent.location.href = redirectUrl;
            } else {
              window.location.href = redirectUrl;
            }
            return;
          } else {
            // For normal mode, show auth popup
            setShowAuthPopup(true);
            return;
          }
        }

        // Show specific error for insufficient credits
        if (error.data?.code === "PAYMENT_REQUIRED") {
          if (embedded) {
            // For embedded mode, redirect to normal page with credit error
            const redirectUrl = `${baseUrl}/?error=insufficient_credits&description=${encodeURIComponent(lastSubmittedDescription)}`;
            if (window.parent && window.parent !== window) {
              window.parent.location.href = redirectUrl;
            } else {
              window.location.href = redirectUrl;
            }
            return;
          } else {
            // For normal mode, check if user is a free user
            const isFreeUser = hasNeverPaidData?.hasNeverPaid ?? false;
            if (isFreeUser) {
              showNeedPaidPlanToast({
                onUpgrade: () => setIsPricingModalOpen(true),
              });
            } else {
              showInsufficientCreditsToast({
                onUpgrade: () => setIsPricingModalOpen(true),
              });
            }
          }
        } else {
          // Only show error toast in normal mode
          if (!embedded) {
            toast.error(`Failed to create project: ${error.message}`);
          }
        }
      },
    }),
  );

  const cancelCreate = useMutation(
    trcp.projects.cancelCreate.mutationOptions({
      onMutate: () => {
        if (!embedded) {
          toast.success("Canceling project...");
        }
        // Immediately prevent any pending navigations
        setIsNavigating(false);
      },
      onSuccess: () => {
        if (!embedded) {
          toast.success("Project creation canceled");
        }
      },
      onError: (error) => {
        if (!embedded) {
          toast.error(`Failed to cancel: ${error?.message || "Unknown error"}`);
        }
      },
      onSettled: () => {
        // Clean up local state regardless of cancel outcome
        try {
          createProject.reset();
        } catch {
          if (!embedded) {
            toast.error("Failed to reset project creation");
          }
        }
        currentCreationIdRef.current = null;
        setIsNavigating(false);
      },
    }),
  );

  // Enhance prompt mutation
  const enhancePrompt = useMutation(
    trcp.prompts.enhancePrompt.mutationOptions({
      onSuccess: async (data) => {
        // Stream the enhanced prompt into the textarea
        const enhancedText = data.enhancedPrompt;
        setIsEnhancing(false);

        // Simulate streaming by gradually updating the text
        let currentText = "";
        const words = enhancedText.split(" ");

        for (let i = 0; i < words.length; i++) {
          currentText += (i > 0 ? " " : "") + words[i];
          form.setValue("description", currentText, {
            shouldValidate: true,
            shouldDirty: true,
          });
          // Small delay to create streaming effect
          await new Promise((resolve) => setTimeout(resolve, 30));
        }

        // Only show success toast in non-embedded mode
        if (!embedded) {
          toast.success("Prompt enhanced!");
        }
      },
      onError: (error) => {
        setIsEnhancing(false);

        if (error.data?.code === "PAYMENT_REQUIRED") {
          if (embedded) {
            // For embedded mode, redirect to normal page with credit error
            const currentDesc = form.watch("description");
            const redirectUrl = `${baseUrl}/?error=insufficient_credits${currentDesc ? `&description=${encodeURIComponent(currentDesc)}` : ""}`;
            if (window.parent && window.parent !== window) {
              window.parent.location.href = redirectUrl;
            } else {
              window.location.href = redirectUrl;
            }
          } else {
            showInsufficientCreditsToast({
              onUpgrade: () => setIsPricingModalOpen(true),
            });
          }
        } else {
          if (embedded) {
            // For embedded mode, redirect to normal page with error
            const currentDesc = form.watch("description");
            const redirectUrl = `${baseUrl}/?error=enhance_failed${currentDesc ? `&description=${encodeURIComponent(currentDesc)}` : ""}`;
            if (window.parent && window.parent !== window) {
              window.parent.location.href = redirectUrl;
            } else {
              window.location.href = redirectUrl;
            }
          } else {
            toast.error(`Failed to enhance prompt: ${error.message}`);
          }
        }
      },
    }),
  );

  const handleEnhancePrompt = async () => {
    const currentPrompt = form.watch("description");

    if (!currentPrompt || currentPrompt.trim().length < 5) {
      if (embedded) {
        // For embedded mode, redirect to normal page with validation error
        const redirectUrl = `${baseUrl}/?error=prompt_too_short${currentPrompt ? `&description=${encodeURIComponent(currentPrompt)}` : ""}`;
        if (window.parent && window.parent !== window) {
          window.parent.location.href = redirectUrl;
        } else {
          window.location.href = redirectUrl;
        }
      } else {
        toast.error("Please enter a prompt first (at least 5 characters)");
      }
      return;
    }

    if (currentPrompt.length > 2000) {
      if (embedded) {
        // For embedded mode, redirect to normal page with validation error
        const redirectUrl = `${baseUrl}/?error=prompt_too_long&description=${encodeURIComponent(currentPrompt)}`;
        if (window.parent && window.parent !== window) {
          window.parent.location.href = redirectUrl;
        } else {
          window.location.href = redirectUrl;
        }
      } else {
        toast.error("Prompt is too long. Maximum 2000 characters allowed.");
      }
      return;
    }

    setIsEnhancing(true);
    await enhancePrompt.mutateAsync({ prompt: currentPrompt });
  };

  const onSubmit = (data: ProjectFormData) => {
    // Fast validation checks (keep all validations but optimize)
    if (!form.formState.isValid) {
      const errors = form.formState.errors;
      if (errors.description) {
        if (embedded) {
          // For embedded mode, redirect with validation error
          const redirectUrl = `${baseUrl}?error=invalid_description&description=${encodeURIComponent(data.description)}`;
          if (window.parent && window.parent !== window) {
            window.parent.location.href = redirectUrl;
          } else {
            window.location.href = redirectUrl;
          }
        } else {
          // Only show validation toast in normal mode
          toast.error(errors.description.message);
        }
        return;
      }
    }

    if (hasInsufficientCredits) {
      if (embedded) {
        // For embedded mode, redirect to normal page with credit error
        const redirectUrl = `${baseUrl}/?error=insufficient_credits&description=${encodeURIComponent(data.description)}`;
        if (window.parent && window.parent !== window) {
          window.parent.location.href = redirectUrl;
        } else {
          window.location.href = redirectUrl;
        }
        return;
      } else {
        // For normal mode, check if user is a free user
        const isFreeUser = hasNeverPaidData?.hasNeverPaid ?? false;
        if (isFreeUser) {
          showNeedPaidPlanToast({
            onUpgrade: () => setIsPricingModalOpen(true),
          });
          return;
        } else {
          showInsufficientCreditsToast({
            onUpgrade: () => setIsPricingModalOpen(true),
          });
        }
        return;
      }
    }

    // Show toast and start project creation (only in normal mode)
    if (!embedded) {
      const fileCount = attachedImages.length;
      if (fileCount > 0) {
        toast.success(
          `Creating your project with ${fileCount} file${fileCount > 1 ? "s" : ""}...`,
        );
      } else {
        toast.success("Creating your project...");
      }
    }
    // Reset cancel flag on fresh submit
    canceledRef.current = false;
    setLastSubmittedDescription(data.description);

    // Replace display prompt (without IMPORTANT section) with full prompt (with IMPORTANT section) before sending
    let finalDescription = data.description;
    if (baseStylingPrompt) {
      const displayPrompt = getDisplayPrompt(baseStylingPrompt);
      // If the description contains the display version, replace it with the full version
      if (finalDescription.includes(displayPrompt)) {
        finalDescription = finalDescription.replace(
          displayPrompt,
          baseStylingPrompt,
        );
      }
    }

    // Add implicit SPA instruction to all project creations to prevent unnecessary reloads
    const spaInstruction = "Make it a single page application (SPA).";
    const spaInstructionLower = spaInstruction.toLowerCase();
    // Only add if not already present (case-insensitive check)
    if (!finalDescription.toLowerCase().includes(spaInstructionLower)) {
      finalDescription += `\n\n${spaInstruction}`;
    }

    const id = nanoid();
    currentCreationIdRef.current = id;
    createProject.mutate({
      value: finalDescription,
      creationId: id,
    });
  };

  const handleStopCreating = () => {
    // Avoid duplicate cancels
    if (cancelCreate.isPending) return;

    // Flip canceled flag so success/error handlers skip navigation
    canceledRef.current = true;

    // Require a valid creation id
    const id = currentCreationIdRef.current;
    if (!id) return;

    // Fire cancel; side-effects handled in mutation options
    cancelCreate.mutate({ creationId: id });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  const description = form.watch("description");
  const hasInsufficientCredits =
    currentCredits !== undefined && currentCredits.creditBalance < 1;

  // Character count tracking using reusable hook
  const {
    charCount,
    isApproachingLimit,
    isOverLimit,
    charsRemaining,
    limit,
    warningThreshold,
  } = useCharacterLimit(description || "");

  // Check if description is valid (meets schema requirements)
  const isDescriptionValid =
    description &&
    description.trim().length >= 5 &&
    description.trim().length <= CHARACTER_LIMIT;

  // Don't disable button for insufficient credits - let them click to see the toast!
  const isCanceling = cancelCreate.isPending;

  const isCreating = (createProject.isPending || isNavigating) && !isCanceling;
  // When creating, keep the button enabled so users can click to stop
  const isButtonDisabled =
    isCreating || isCanceling ? false : !isDescriptionValid;

  return (
    <>
      {!embedded && (
        <AuthDialog
          isOpen={showAuthPopup}
          onClose={() => setShowAuthPopup(false)}
          projectDescription={
            form.watch("description") ||
            lastSubmittedDescription ||
            initialDescription
          }
        />
      )}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={`relative mx-auto mb-8 flex flex-col ${embedded ? "bg-card" : "bg-white dark:bg-[#0A0E0D]"} mx-auto max-w-[768px] rounded-[28px] border p-[13px] transition-all focus-within:ring-2 md:min-w-[768px] ${isCreating || isCanceling ? "opacity-60" : ""
            } ${form.formState.errors.description || isOverLimit
              ? "border-red-500 drop-shadow-lg drop-shadow-[#EE9F2D0A] focus-within:border-red-500 focus-within:ring-red-500/50"
              : isApproachingLimit
                ? "focus-within:none border-[#FBBC55] drop-shadow-lg drop-shadow-[#EE9F2D0A] focus-within:border-[#FBBC55]"
                : "focus-within:border-ring focus-within:ring-ring/50 " +
                (embedded
                  ? "border-[#60606033] bg-white"
                  : "border-[#60606033]")
            }`}
          style={{ boxShadow: '0 8px 10px -6px rgba(0,0,0,0.04), 0 20px 25px -5px rgba(0,0,0,0.04)' }}
        >
          <div className="">
            <ChatFileUpload
              files={attachedImages}
              onFilesChange={setAttachedImages}
              maxFiles={10}
              maxSize={10 * 1024 * 1024}
              onTriggerUpload={() => {
                const input = document.querySelector(
                  'input[type="file"]',
                ) as HTMLInputElement;
                if (input) {
                  fileInputTriggerRef.current = () => input.click();
                }
              }}
            >
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        ref={(e) => {
                          field.ref(e);
                          textareaRef.current = e;
                        }}
                        onKeyDown={handleKeyPress}
                        placeholder="What do you want to build? e.g. 'Airbnb clone' or 'to do list app'"
                        className={`max-h-[200px] min-h-[146px] w-full !rounded-none pl-0 ${embedded ? "bg-card text-foreground" : "bg-white text-black dark:bg-[#0A0E0D] dark:text-white"} rounded-[28px] border-none py-0 pb-4 shadow-none ${embedded ? "placeholder-muted-foreground" : "placeholder-foreground"} resize-none overflow-y-auto transition-all focus:outline-none focus-visible:border-none focus-visible:ring-0`}
                        disabled={createProject.isPending || isNavigating}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </ChatFileUpload>

            <div className="right-0 bottom-3 left-0 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {/* Agent Dropdown */}
                <AgentDropdown />

                {/* Mobile: Dropdown with all options - hidden on desktop */}
                <div className="md:hidden">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "hover:text-foreground flex min-w-fit items-center gap-[6px] rounded-full border-[#F5F5F5] bg-white px-[9px] py-[13px] text-[#5F5F5D] dark:border-[#232D29] dark:bg-[#313C38] dark:text-white",
                          (attachedImages.length > 0 ||
                            selectedStylingPreset ||
                            isEnhancing) &&
                          "bg-[#E8F5F1] text-[#1E9A80] dark:bg-[#E8F5F1] dark:text-[#1E9A80]",
                        )}
                      >
                        <Plus className="h-4 w-4 flex-shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[200px] rounded-[12px] bg-white p-1 shadow-lg dark:bg-[#1A2421]"
                    >
                      <DropdownMenuItem
                        onClick={() => {
                          if (fileInputTriggerRef.current) {
                            fileInputTriggerRef.current();
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2",
                          attachedImages.length > 0 &&
                          "bg-[#E8F5F1] text-[#1E9A80] dark:bg-[#E8F5F1] dark:text-[#1E9A80]",
                        )}
                      >
                        <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                          <Plus className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">Add Files</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          if (embedded) {
                            const currentDesc = form.watch("description");
                            const redirectUrl = `${baseUrl}/?openStyling=true${currentDesc ? `&description=${encodeURIComponent(currentDesc)}` : ""}`;
                            if (window.parent && window.parent !== window) {
                              window.parent.location.href = redirectUrl;
                            } else {
                              window.location.href = redirectUrl;
                            }
                          } else {
                            setIsStylingDialogOpen(true);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2",
                          selectedStylingPreset &&
                          "bg-[#F3E8FF] text-[#7E22CE] dark:bg-[#F3E8FF] dark:text-[#7E22CE]",
                        )}
                      >
                        <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                          <WandSparkles className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">
                          {selectedStylingPreset || "Design Style"}
                        </span>
                      </DropdownMenuItem>

                      {/* <DropdownMenuItem
                        onClick={() => {
                          if (embedded) {
                            // For embedded mode, redirect to parent page
                            const redirectUrl = `${baseUrl}/?openImport=true`;
                            if (window.parent && window.parent !== window) {
                              window.parent.location.href = redirectUrl;
                            } else {
                              window.location.href = redirectUrl;
                            }
                          } else {
                            setIsImportDialogOpen(true);
                          }
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2"
                      >
                        <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                          <ImportCodeIcon className="h-3.5 w-3.5 text-[#16A085]" />
                        </div>
                        <span className="text-sm font-medium">Import Code</span>
                      </DropdownMenuItem> */}

                      <DropdownMenuItem
                        onClick={() => {
                          if (embedded) {
                            const redirectUrl = `${baseUrl}/?openConnectors=true`;
                            if (window.parent && window.parent !== window) {
                              window.parent.location.href = redirectUrl;
                            } else {
                              window.location.href = redirectUrl;
                            }
                          } else {
                            setIsConnectorsModalOpen(true);
                          }
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2"
                      >
                        <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                          <Link2 className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">Connectors</span>
                      </DropdownMenuItem>

                      {description && description.trim().length >= 5 && (
                        <DropdownMenuItem
                          onClick={handleEnhancePrompt}
                          disabled={
                            isEnhancing ||
                            createProject.isPending ||
                            isNavigating
                          }
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2",
                            isEnhancing &&
                            "bg-[#E8F5F1] text-[#1E9A80] dark:bg-[#E8F5F1] dark:text-[#1E9A80]",
                          )}
                        >
                          <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-medium">
                            {isEnhancing ? "Enhancing..." : "Improve Prompt"}
                          </span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Desktop: Dropdown + Improve Prompt button - hidden on mobile */}
                <div className="hidden items-center space-x-2 md:flex">
                  {/* "+" Dropdown with Add Files, Design Style, Import Code, Connectors */}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "hover:text-foreground flex min-w-fit items-center gap-[6px] rounded-full border-[#F5F5F5] bg-white px-[9px] py-[13px] text-[#5F5F5D] dark:border-[#232D29] dark:bg-[#313C38] dark:text-white",
                          (attachedImages.length > 0 || selectedStylingPreset) &&
                          "bg-[#E8F5F1] text-[#1E9A80] dark:bg-[#E8F5F1] dark:text-[#1E9A80]",
                        )}
                      >
                        <Plus className="h-4 w-4 flex-shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[200px] rounded-[12px] bg-white p-1 shadow-lg dark:bg-[#1A2421]"
                    >
                      <DropdownMenuItem
                        onClick={() => {
                          if (fileInputTriggerRef.current) {
                            fileInputTriggerRef.current();
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2",
                          attachedImages.length > 0 &&
                          "bg-[#E8F5F1] text-[#1E9A80] dark:bg-[#E8F5F1] dark:text-[#1E9A80]",
                        )}
                      >
                        <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                          <Plus className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">Add Files</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => {
                          if (embedded) {
                            const currentDesc = form.watch("description");
                            const redirectUrl = `${baseUrl}/?openStyling=true${currentDesc ? `&description=${encodeURIComponent(currentDesc)}` : ""}`;
                            if (window.parent && window.parent !== window) {
                              window.parent.location.href = redirectUrl;
                            } else {
                              window.location.href = redirectUrl;
                            }
                          } else {
                            setIsStylingDialogOpen(true);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2",
                          selectedStylingPreset &&
                          "bg-[#F3E8FF] text-[#7E22CE] dark:bg-[#F3E8FF] dark:text-[#7E22CE]",
                        )}
                      >
                        <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                          <WandSparkles className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">
                          {selectedStylingPreset || "Design Style"}
                        </span>
                      </DropdownMenuItem>

                      {/* <DropdownMenuItem
                        onClick={() => {
                          if (embedded) {
                            const redirectUrl = `${baseUrl}/?openImport=true`;
                            if (window.parent && window.parent !== window) {
                              window.parent.location.href = redirectUrl;
                            } else {
                              window.location.href = redirectUrl;
                            }
                          } else {
                            setIsImportDialogOpen(true);
                          }
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2"
                      >
                        <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                          <FolderCode className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">Import Code</span>
                      </DropdownMenuItem> */}

                      <DropdownMenuItem
                        onClick={() => {
                          if (embedded) {
                            const redirectUrl = `${baseUrl}/?openConnectors=true`;
                            if (window.parent && window.parent !== window) {
                              window.parent.location.href = redirectUrl;
                            } else {
                              window.location.href = redirectUrl;
                            }
                          } else {
                            setIsConnectorsModalOpen(true);
                          }
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2"
                      >
                        <div className="dark:bg-prj-bg-secondary flex h-6 w-6 items-center justify-center rounded-[4px] bg-[#F3F3EE]">
                          <Link2 className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm font-medium">Connectors</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Improve Prompt button - separate from dropdown */}
                  {description && description.trim().length >= 5 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleEnhancePrompt}
                            disabled={
                              isEnhancing ||
                              createProject.isPending ||
                              isNavigating
                            }
                            className={cn(
                              "hover:text-foreground flex min-w-fit items-center gap-[6px] rounded-full border-[#F5F5F5] bg-white px-[9px] py-[13px] text-[#5F5F5D] dark:border-[#232D29] dark:bg-[#313C38] dark:text-white",
                              isEnhancing &&
                              "bg-[#E8F5F1] text-[#1E9A80] dark:bg-[#E8F5F1] dark:text-[#1E9A80]",
                            )}
                          >
                            <Sparkles className="h-4 w-4 flex-shrink-0" />
                            {isEnhancing ? (
                              <ShimmeringText
                                text="Enhancing..."
                                duration={1}
                                className="text-xs font-medium"
                              />
                            ) : (
                              <span className="text-xs font-medium whitespace-nowrap">
                                Improve Prompt
                              </span>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>
                            AI will rewrite & expand your prompt
                            <br /> for better clarity and impact
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Character counter */}
                <CharacterCounter
                  charCount={charCount}
                  limit={limit}
                  warningThreshold={warningThreshold}
                />
              </div>

              {/* Smart Submit Button: Mic (empty) → Send (typing) */}
              <div className="flex items-center gap-2">
                {/* Waveform visualization when recording */}
                {isVoiceRecording && (
                  <div className="bg-muted/50 flex h-8 items-center gap-0.5 rounded-full px-3">
                    {voiceFrequencyData.map((value, i) => {
                      const height = Math.max(2, (value / 100) * 24);
                      return (
                        <div
                          key={i}
                          className="bg-foreground/40 w-0.5 rounded-full transition-all duration-75"
                          style={{
                            height: `${height}px`,
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                <VoiceInput
                  onTranscript={(text) => {
                    // Always append to the current text, not the initial text
                    const currentDescription =
                      form.getValues("description") || "";
                    const newDescription = currentDescription
                      ? `${currentDescription} ${text}`.trim()
                      : text;
                    form.setValue("description", newDescription, {
                      shouldValidate: true,
                      shouldDirty: true,
                      shouldTouch: true,
                    });

                    // Move cursor to end after inserting
                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.selectionStart =
                          newDescription.length;
                        textareaRef.current.selectionEnd =
                          newDescription.length;
                        textareaRef.current.focus();
                      }
                    }, 0);
                  }}
                  onLiveTranscript={(liveText) => {
                    // For live transcript, show preview by appending to initial text
                    const currentDescription = initialVoiceTextRef.current;
                    const newDescription = currentDescription
                      ? `${currentDescription} ${liveText}`.trim()
                      : liveText;
                    form.setValue("description", newDescription, {
                      shouldValidate: false,
                      shouldDirty: false,
                    });
                  }}
                  isAuthenticated={isAuthenticated}
                  isPaidUser={isPaidUser}
                  onUpgradeClick={() => setIsPricingModalOpen(true)}
                  onAuthRequired={() => setShowAuthPopup(true)}
                  disabled={hasInsufficientCredits || isOverLimit}
                  onRecordingStateChange={(
                    recording,
                    processing,
                    level,
                    frequencyData,
                  ) => {
                    if (recording && !isVoiceRecording) {
                      // Store the current text when recording starts
                      initialVoiceTextRef.current =
                        form.getValues("description") || "";
                    }
                    setIsVoiceRecording(recording);
                    setIsVoiceProcessing(processing);
                    setAudioLevel(level || 0);
                    setVoiceFrequencyData(frequencyData || []);
                  }}
                  className={cn(
                    "h-8 w-8",
                    // Only hide if we are in "creating" state (show Stop button instead)
                    // Otherwise always show Mic (even if we have text, to allow appending voice)
                    isCreating ? "hidden" : "flex",
                  )}
                />

                {/* Send / Stop Button - Hidden during voice recording */}
                {!isVoiceRecording && (
                  <Button
                    type={isCreating ? "button" : "submit"}
                    onClick={isCreating ? handleStopCreating : undefined}
                    disabled={isButtonDisabled}
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-full text-white transition-colors hover:shadow-xl",
                      hasInsufficientCredits
                        ? "bg-orange-500 hover:bg-orange-600"
                        : embedded
                          ? "bg-primary hover:bg-primary/90"
                          : "bg-[#1E9A80] hover:bg-[#1E9A80]/90",
                      embedded ? "disabled:bg-muted" : "disabled:bg-gray-400",
                    )}
                    title={
                      isCreating
                        ? "Stop creating"
                        : hasInsufficientCredits
                          ? "Click to see credit options - 1 credit required"
                          : "Create project (1 credit)"
                    }
                  >
                    {isCreating ? (
                      <SquareIcon className="size-3 rounded-xs bg-white" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </form>
      </Form>

      {/* Prompt Presets - Always visible */}

      {isCreating && (
        <div className="text-foreground mb-8">
          <div className="flex items-center justify-center space-x-2">
            <div className="bg-foreground h-2 w-2 animate-pulse rounded-full"></div>
            <div
              className="bg-foreground h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="bg-foreground h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <span className="ml-2 drop-shadow-md">Creating project...</span>
          </div>
        </div>
      )}

      {isCanceling && (
        <div className="text-foreground mb-8">
          <div className="flex items-center justify-center space-x-2">
            <div className="bg-foreground h-2 w-2 animate-pulse rounded-full"></div>
            <div
              className="bg-foreground h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="bg-foreground h-2 w-2 animate-pulse rounded-full"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <span className="ml-2 drop-shadow-md">Canceling project...</span>
          </div>
        </div>
      )}
      <PromptPresets
        onPresetSelect={(preset: PromptPreset) => {
          // If there's a styling prompt, preserve it (display version) and add the preset as base description
          const displayStylingPrompt = baseStylingPrompt
            ? getDisplayPrompt(baseStylingPrompt)
            : "";
          const newDescription = displayStylingPrompt
            ? `${preset.prompt}\n\n${displayStylingPrompt}`
            : preset.prompt;

          form.setValue("description", newDescription, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
          });

          // Focus the textarea after setting the value
          const textarea = document.querySelector(
            'textarea[name="description"]',
          ) as HTMLTextAreaElement;
          if (textarea) {
            textarea.focus();
          }
        }}
        onImportClick={() => {
          if (embedded) {
            const redirectUrl = `${baseUrl}/?openImport=true`;
            if (window.parent && window.parent !== window) {
              window.parent.location.href = redirectUrl;
            } else {
              window.location.href = redirectUrl;
            }
          } else {
            setIsImportDialogOpen(true);
          }
        }}
        className="mb-8 flex justify-center"
      />
      {!embedded && (
        <PricingModal
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
        />
      )}

      {!embedded && (
        <StylingInstructionsDialog
          isOpen={isStylingDialogOpen}
          onClose={() => setIsStylingDialogOpen(false)}
          currentlySelected={selectedStylingPreset}
          onUpgrade={() => setIsPricingModalOpen(true)}
          onStyleSelect={(preset: StylingPreset) => {
            const currentDescription = form.watch("description") || "";

            // Remove previous styling prompt if it exists
            let baseDescription = currentDescription;
            if (baseStylingPrompt) {
              // Remove the display version (without IMPORTANT section) from description
              const previousDisplayPrompt = getDisplayPrompt(baseStylingPrompt);
              baseDescription = currentDescription
                .replace(previousDisplayPrompt, "")
                .trim();
            }

            // Store the full prompt (with IMPORTANT section) for AI
            setBaseStylingPrompt(preset.prompt);

            // Use display version (without IMPORTANT section) for user visibility
            const displayPrompt = getDisplayPrompt(preset.prompt);
            const newDescription = baseDescription
              ? `${baseDescription}\n\n${displayPrompt}`
              : displayPrompt;

            form.setValue("description", newDescription, {
              shouldValidate: true,
              shouldDirty: true,
              shouldTouch: true,
            });

            // Set the selected styling preset to show in the button
            setSelectedStylingPreset(preset.label);

            // Focus the textarea after setting the value
            const textarea = document.querySelector(
              'textarea[name="description"]',
            ) as HTMLTextAreaElement;
            if (textarea) {
              textarea.focus();
            }

            // Set the preset image if available (passed from StylingInstructionsDialog)
            if (preset.imageUrl) {
              console.log(
                "[GenerativeChatInput] Setting preset image:",
                preset.imageUrl,
              );
              // Convert to base64 data URI in the browser so the backend never has to fetch it
              void (async () => {
                const dataUri = await convertImageUrlToDataUri(
                  preset.imageUrl!,
                );
                if (dataUri) {
                  console.log(
                    "[GenerativeChatInput] Preset image converted to base64 (preview)",
                    {
                      length: dataUri.length,
                      preview: dataUri.substring(0, 80),
                    },
                  );
                  setPresetImage(dataUri);
                } else {
                  setPresetImage(null);
                }
              })();
            }
          }}
          onImageStyleSelect={(imageUrl: string, stylePrompt: string) => {
            const currentDescription = form.watch("description") || "";

            // Remove previous styling prompt if it exists (use display version for removal)
            let baseDescription = currentDescription;
            if (baseStylingPrompt) {
              const previousDisplayPrompt = getDisplayPrompt(baseStylingPrompt);
              baseDescription = currentDescription
                .replace(previousDisplayPrompt, "")
                .trim();
            }

            // Add new styling prompt from image analysis
            const newDescription = baseDescription
              ? `${baseDescription}\n\n${stylePrompt}`
              : stylePrompt;

            form.setValue("description", newDescription, {
              shouldValidate: true,
              shouldDirty: true,
              shouldTouch: true,
            });

            // Store the current styling prompt for future replacement
            setBaseStylingPrompt(stylePrompt);

            // Set a custom label for image-based styling
            setSelectedStylingPreset("Custom Style (Image)");

            // Focus the textarea after setting the value
            const textarea = document.querySelector(
              'textarea[name="description"]',
            ) as HTMLTextAreaElement;
            if (textarea) {
              textarea.focus();
            }

            // Convert the provided image URL to a base64 data URI for storage
            if (imageUrl) {
              console.log(
                "[GenerativeChatInput] Setting image-based custom style preset image:",
                imageUrl,
              );
              void (async () => {
                const dataUri = await convertImageUrlToDataUri(imageUrl);
                if (dataUri) {
                  console.log(
                    "[GenerativeChatInput] Image-based style preset converted to base64 (preview)",
                    {
                      length: dataUri.length,
                      preview: dataUri.substring(0, 80),
                    },
                  );
                  setPresetImage(dataUri);
                } else {
                  setPresetImage(null);
                }
              })();
            }
          }}
        />
      )}

      {/* Code Import Dialog */}
      {!embedded && (
        <CodeImportDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onImportComplete={(projectId, initialPrompt) => {
            const url = initialPrompt
              ? `/projects/${projectId}?prompt=${encodeURIComponent(initialPrompt)}`
              : `/projects/${projectId}`;
            router.push(url);
          }}
        />
      )}

      {/* Workspace Settings Modal (Connectors) */}
      {!embedded && (
        <WorkspaceSettingsModal
          open={isConnectorsModalOpen}
          onOpenChange={setIsConnectorsModalOpen}
          defaultTab="connectors"
        />
      )}
    </>
  );
};
