"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface RemixButtonProps {
  templateId: string;
  templateName: string;
  variant?: "default" | "large" | "icon" | "outline";
  className?: string;
  onSuccess?: (projectId: string) => void;
}

export function RemixButton({
  templateId,
  templateName,
  variant = "default",
  className,
  onSuccess,
}: RemixButtonProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const [showSuccess, setShowSuccess] = useState(false);

  const remixMutation = useMutation(
    trpc.templates.remix.mutationOptions({
      onMutate: () => {
        toast.loading("Remixing template...", { id: "remix" });
      },
      onSuccess: (data) => {
        toast.dismiss("remix");
        toast.success(`${templateName} added to your workspace!`);

        // Show success checkmark briefly
        setShowSuccess(true);

        // Call custom success handler if provided
        onSuccess?.(data.projectId);

        // Redirect after a brief delay
        setTimeout(() => {
          router.push(data.redirectUrl);
        }, 500);
      },
      onError: (error) => {
        toast.dismiss("remix");

        // Check error message content for different scenarios
        const errorMessage = error.message.toLowerCase();

        if (
          errorMessage.includes("unauthorized") ||
          errorMessage.includes("logged in")
        ) {
          toast.error("Please sign in to remix this template", {
            action: {
              label: "Sign In",
              onClick: () => router.push("/auth/signin"),
            },
          });
        } else if (
          errorMessage.includes("insufficient credits") ||
          errorMessage.includes("payment")
        ) {
          toast.error("Insufficient credits to remix this template", {
            action: {
              label: "Add Credits",
              onClick: () => router.push("/pricing"),
            },
          });
        } else {
          toast.error(`Failed to remix: ${error.message}`);
        }
      },
    }),
  );

  const handleRemix = (e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (!session) {
      toast.error("Please sign in to remix templates", {
        action: {
          label: "Sign In",
          onClick: () => router.push("/auth/signin"),
        },
      });
      return;
    }

    remixMutation.mutate({ templateId });
  };

  const isLoading = remixMutation.isPending;
  const isSuccess = showSuccess;

  // Icon only variant
  if (variant === "icon") {
    return (
      <Button
        size="icon"
        variant="outline"
        onClick={handleRemix}
        disabled={isLoading || isSuccess}
        className={className}
      >
        {isSuccess ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        )}
      </Button>
    );
  }

  // Large variant
  if (variant === "large") {
    return (
      <Button
        size="lg"
        onClick={handleRemix}
        disabled={isLoading || isSuccess}
        className={cn("w-full text-base", className)}
      >
        {isSuccess ? (
          <>
            <Check className="mr-2 h-5 w-5" />
            Remixed!
          </>
        ) : isLoading ? (
          <>
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
            Remixing...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-5 w-5" />
            Remix This Template
          </>
        )}
      </Button>
    );
  }

  // Default variant
  return (
    <Button
      variant={variant === "outline" ? "outline" : "default"}
      onClick={handleRemix}
      disabled={isLoading || isSuccess}
      className={className}
    >
      {isSuccess ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Remixed!
        </>
      ) : isLoading ? (
        <>
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Remixing...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Remix
        </>
      )}
    </Button>
  );
}
