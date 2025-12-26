"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { showInsufficientCreditsToast } from "@/components/toast-notifications";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STYLING_PRESETS, type StylingPreset } from "@/data/styling-presets";
import { X, Sun, Moon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/info-tooltip";

type TabMode = "basic" | "advanced";

interface StylingInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStyleSelect: (preset: StylingPreset) => void;
  onImageStyleSelect?: (imageUrl: string, stylePrompt: string) => void;
  currentlySelected?: string | null;
  onUpgrade?: () => void; // Callback to open pricing modal
}

export function StylingInstructionsDialog({
  isOpen,
  onClose,
  onStyleSelect,
  onImageStyleSelect,
  currentlySelected,
  onUpgrade,
}: StylingInstructionsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabMode>("basic");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(
    currentlySelected || null,
  );
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [previewSuccess, setPreviewSuccess] = useState(false);
  const trpc = useTRPC();
  const { theme } = useTheme();

  // Track preview mode for each card (light/dark)
  const [cardPreviewModes, setCardPreviewModes] = useState<
    Record<string, "light" | "dark">
  >({});

  const allowedHosts = [
    "cdn.dribbble.com",
    "imgur.com",
    "i.imgur.com",
    "images.unsplash.com",
    "via.placeholder.com",
    "lh3.googleusercontent.com",
    "avatars.githubusercontent.com",
    "behance.net",
  ];

  const analyzeImageMutation = useMutation(
    trpc.prompts.analyzeStyleImage.mutationOptions({
      onSuccess: () => {
        toast.success("Style analyzed successfully!");
      },
      onError: (error: any) => {
        console.error("Error analyzing image:", error);
        if (error.message?.includes("Insufficient credits")) {
          // Show insufficient credits toast with upgrade action
          if (onUpgrade) {
            showInsufficientCreditsToast({
              onUpgrade,
              title: "Insufficient Credits",
              description:
                "You have run out of credits.\nUpgrade your plan or purchase more credits to continue.",
            });
          } else {
            toast.error(
              "Insufficient credits. Please purchase more credits to continue.",
            );
          }
          setImageError("Insufficient credits.");
        } else {
          // Generic error
          toast.error(error.message);
          setImageError(error.message);
        }
      },
    }),
  );

  const handleStyleSelect = (preset: StylingPreset) => {
    setSelectedStyle(preset.id);
  };

  // Helper to get the effective preview mode for a card
  // Defaults to global theme if card-specific mode hasn't been set
  const getCardPreviewMode = (presetId: string): "light" | "dark" => {
    return cardPreviewModes[presetId] || (theme === "dark" ? "dark" : "light");
  };

  const validateImageUrl = (url: string): boolean => {
    const trimmed = url.trim();
    if (!trimmed) return false;

    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.toLowerCase();
      const search = parsed.search.toLowerCase();

      const extensionPattern = /\.(jpg|jpeg|png|webp|gif)(?:$|\?)/;
      if (extensionPattern.test(pathname)) {
        return true;
      }

      const queryPattern = /(format|fm|ext)=([^&]*)(jpg|jpeg|png|webp|gif)/;
      if (queryPattern.test(search)) {
        return true;
      }

      // Check if hostname matches or is a subdomain of allowed hosts
      const isAllowedHost = allowedHosts.some(
        (host) =>
          parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
      );
      if (isAllowedHost) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  const isAllowedHostname = (url: string): boolean => {
    try {
      const hostname = new URL(url).hostname;
      return allowedHosts.some(
        (host) => hostname === host || hostname.endsWith(`.${host}`),
      );
    } catch {
      return false;
    }
  };

  const handleImageUrlChange = (value: string) => {
    setImageUrl(value);
    setImageError("");
    setPreviewSuccess(false);
  };

  const handleApply = async () => {
    if (activeTab === "basic") {
      const preset = STYLING_PRESETS.find((p) => p.id === selectedStyle);
      if (preset) {
        // Determine which collage image to send to AI based on preview mode
        // Note: UI shows thumbnails, but AI receives collage images for better results
        const currentPreviewMode = getCardPreviewMode(preset.id);
        const referenceImageUrl =
          preset.darkImageUrl && currentPreviewMode === "dark"
            ? preset.darkImageUrl
            : preset.imageUrl;

        // Determine mode: if image URL contains "dark", it's dark mode; otherwise light mode
        const selectedMode = referenceImageUrl.toLowerCase().includes("dark")
          ? "dark"
          : "light";

        // Create mode instruction
        const modeInstruction =
          selectedMode === "dark"
            ? `\n\nTHEME MODE REQUIREMENT: YOU MUST BUILD ONLY DARK MODE. `
            : `\n\nTHEME MODE REQUIREMENT: YOU MUST BUILD ONLY LIGHT MODE. `;

        let enhancedPrompt = preset.prompt;
        const importantIndex = enhancedPrompt.indexOf("IMPORTANT:");

        if (importantIndex !== -1) {
          // Insert mode instruction before IMPORTANT section
          enhancedPrompt =
            enhancedPrompt.substring(0, importantIndex).trim() +
            modeInstruction +
            "\n\n" +
            enhancedPrompt.substring(importantIndex);
        } else {
          // If no IMPORTANT section, just append at the end
          enhancedPrompt = enhancedPrompt + modeInstruction;
        }
        // Add reference image instruction at the very end
        enhancedPrompt += `\n\nREFERENCE IMAGE: Extract design patterns (colors, typography, spacing, borders, shadows) from the reference—do NOT copy its content or layout.`;
        const enhancedPrompt_old = `
${modeInstruction}
${preset.prompt} 
---

---
REFERENCE IMAGE: Extract design patterns (colors, typography, spacing, borders, shadows) from the reference—do NOT copy its content or layout.`;

        // Pass the preset with the enhanced prompt AND collage image (not thumbnail) for AI
        onStyleSelect({
          ...preset,
          prompt: enhancedPrompt,
          imageUrl: referenceImageUrl, // Send collage image to AI (not thumbnail)
        });
        onClose();
      }
    } else {
      // Advanced mode
      if (!imageUrl.trim()) {
        setImageError("Please enter an image URL.");
        return;
      }

      if (!validateImageUrl(imageUrl)) {
        setImageError(
          "Please enter a valid image URL. Supported formats include .jpg, .jpeg, .png, .webp, .gif",
        );
        return;
      }

      try {
        // Use tRPC mutation to analyze the image
        const result = await analyzeImageMutation.mutateAsync({ imageUrl });

        if (onImageStyleSelect && result) {
          onImageStyleSelect(result.imageUrl, result.stylePrompt);
        }

        // Reset the input state after a successful analysis
        setImageUrl("");
        setImageError("");

        onClose();
      } catch (error) {
        // Error already handled in mutation onError callback
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="flex h-[83%] w-full flex-col gap-0 overflow-hidden px-0 py-0 md:max-w-[900px] lg:max-w-[1121px] bg-white dark:bg-background"
        showCloseButton={false}
      >
        <DialogClose asChild>
          <button className="absolute top-4 right-4 z-10 rounded-[8px] border border-[#E0E6F0] p-2 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
            <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
          </button>
        </DialogClose>

        <DialogHeader className="border-b border-border bg-[#F8F6F3] dark:bg-background p-4 flex flex-col gap-[2px]">
          <DialogTitle
            className="text-[#111625] dark:text-white"
            style={{ fontWeight: 600, fontSize: '16px', lineHeight: '24px' }}
          >
            Add styling instructions
          </DialogTitle>
          <DialogDescription
            className="text-[#525252] dark:text-gray-400"
            style={{ fontWeight: 400, fontSize: '14px', lineHeight: '20px' }}
          >
            {activeTab === "basic"
              ? "Select one or more design styles for your app"
              : "Provide an image as a visual style reference"}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="border-border flex border-b px-4">
          <button
            onClick={() => setActiveTab("basic")}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "basic"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Basic
            {activeTab === "basic" && (
              <div className="bg-primary absolute right-0 bottom-0 left-0 h-0.5" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("advanced")}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "advanced"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Advanced Mode
            {activeTab === "advanced" && (
              <div className="bg-primary absolute right-0 bottom-0 left-0 h-0.5" />
            )}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          {activeTab === "basic" ? (
            // Basic Mode - Preset Grid
            <div className="pt-1 pb-4">
              {/* Preset Grid with Suggest Card */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Existing Presets */}
                {STYLING_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleStyleSelect(preset)}
                    className={cn(
                      "overflow-hidden rounded-lg border text-left transition-all hover:shadow-lg",
                      selectedStyle === preset.id
                        ? "ring-primary/90 ring-2"
                        : "hover:border-primary/50 border-[#E0E6F0]",
                    )}
                  >
                    {/* Image Preview - Use thumbnails for UI display */}
                    <div className="relative h-[171px] w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                      <Image
                        src={
                          // Show thumbnail based on current preview mode (defaults to global theme)
                          getCardPreviewMode(preset.id) === "dark" &&
                            preset.darkThumbnailUrl
                            ? preset.darkThumbnailUrl
                            : preset.thumbnailUrl
                        }
                        alt={preset.label}
                        fill
                        className="object-cover"
                        quality={100}
                        unoptimized
                      />

                      {/* Light/Dark Toggle - Matches Code/Preview Selector Style */}
                      {preset.darkThumbnailUrl && (
                        <div className="bg-prj-bg-secondary absolute top-2 right-2 flex h-[28px] w-[52px] items-center gap-0 rounded-md p-[2px] shadow-sm">
                          {/* Light Mode Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardPreviewModes((prev) => ({
                                ...prev,
                                [preset.id]: "light",
                              }));
                            }}
                            className={cn(
                              "flex h-full w-1/2 items-center justify-center rounded-[6px] p-[4px] transition-all duration-100",
                              getCardPreviewMode(preset.id) === "light"
                                ? "bg-prj-bg-active shadow-sm dark:bg-black"
                                : "",
                            )}
                            title="Light mode"
                          >
                            <Sun
                              className={cn(
                                "h-3.5 w-3.5 transition-opacity dark:text-[#B8C9C3]",
                              )}
                            />
                          </button>

                          {/* Dark Mode Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardPreviewModes((prev) => ({
                                ...prev,
                                [preset.id]: "dark",
                              }));
                            }}
                            className={cn(
                              "flex h-full w-1/2 items-center justify-center rounded-[6px] p-[4px] transition-all duration-100",
                              getCardPreviewMode(preset.id) === "dark"
                                ? "bg-prj-bg-active shadow-sm dark:bg-black"
                                : "",
                            )}
                            title="Dark mode"
                          >
                            <Moon
                              className={cn(
                                "h-3.5 w-3.5 transition-opacity dark:text-[#B8C9C3]",
                              )}
                            />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="relative space-y-2 p-4">
                      <h3 className="text-sm font-bold text-[#2F2F2F] dark:text-white">
                        {preset.label}
                      </h3>
                      <p className="line-clamp-2 text-xs text-[#2F2F2F] dark:text-white">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                ))}
                {/* Suggest a Style Card - styled like a preset */}
                <a
                  href="https://tally.so/r/7Rlax9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:border-primary/50 dark:bg-card overflow-hidden rounded-lg border-2 border-dashed border-[#E0E6F0] bg-white text-left transition-all hover:shadow-lg dark:border-gray-700"
                >
                  {/* Image Preview */}
                  <div className="relative flex h-[171px] w-full items-center justify-center bg-gray-50 dark:bg-gray-800">
                    <Image
                      src="/add_plus.png"
                      alt="Add"
                      width={99}
                      height={99}
                      className="opacity-60 dark:opacity-40"
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    <h3 className="text-sm font-bold text-[#2F2F2F] dark:text-white">
                      Suggest a Style
                    </h3>
                    <p className="line-clamp-2 text-xs text-[#2F2F2F] dark:text-white">
                      Don&apos;t see your favorite design style? Suggest one and
                      we&apos;ll add it!
                    </p>
                  </div>
                </a>
              </div>
            </div>
          ) : (
            // Advanced Mode - Image URL Input
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm dark:text-white">
                  The AI will use an image as a visual reference for styling
                  your app.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="image-url" className="text-sm font-medium">
                    Image URL
                  </Label>
                  <InfoTooltip
                    variant="info"
                    title="Image URL"
                    content={
                      <>
                        Paste a direct link to an image (website, app UI,
                        Dribbble mockup, or a screenshot you like).
                        <br />
                        <br />
                        If you&apos;re using a screenshot, upload it to{" "}
                        <a
                          href="https://imgur.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          Imgur
                        </a>{" "}
                        first and paste the image link here.
                        <br />
                        <br />
                        The AI will use this image&apos;s style to inspire your
                        app&apos;s look.
                      </>
                    }
                    side="right"
                    maxWidth="320px"
                  />
                </div>

                <Input
                  id="image-url"
                  type="url"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  className={cn(
                    "w-full",
                    imageError && "border-red-500 focus-visible:ring-red-500",
                  )}
                />
              </div>
              {imageError && (
                <p className="text-xs text-red-500">{imageError}</p>
              )}

              <div className="space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-800 dark:text-white">
                <h4 className="text-foreground text-sm font-medium">
                  How Advanced Mode works
                </h4>
                <p className="text-muted-foreground text-xs leading-relaxed dark:text-white">
                  Advanced Mode lets you show the AI a visual style you like so
                  it can build your app in that style. The AI will analyze the
                  image&apos;s colors, typography, layout, and overall design
                  language to create styling instructions for your app.
                </p>
              </div>

              {imageUrl &&
                validateImageUrl(imageUrl) &&
                isAllowedHostname(imageUrl) && (
                  <div
                    className={cn(
                      "space-y-2 transition-opacity duration-200",
                      previewSuccess ? "visible" : "invisible",
                    )}
                  >
                    <Label className="text-sm font-medium">Preview</Label>
                    <div className="border-border relative h-[200px] w-full overflow-hidden rounded-lg border">
                      <Image
                        src={imageUrl}
                        alt="Style reference preview"
                        fill
                        className="object-contain"
                        onLoadingComplete={() => setPreviewSuccess(true)}
                        onError={() => setPreviewSuccess(false)}
                      />
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className="flex justify-end gap-2 border-t p-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={analyzeImageMutation.isPending}
            className="bg-white hover:bg-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={
              analyzeImageMutation.isPending ||
              (activeTab === "basic" && !selectedStyle) ||
              (activeTab === "advanced" && !imageUrl.trim())
            }
            className="bg-[#1E9A80] text-white hover:bg-[#1E9A80]/90 dark:bg-white dark:text-black"
          >
            {analyzeImageMutation.isPending ? "Analyzing..." : "Apply"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
