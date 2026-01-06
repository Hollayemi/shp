"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatNumber } from "../lib/utils";

interface TemplateSaveButtonProps {
  templateId: string;
  initialSaved?: boolean;
  initialCount: number;
  variant?: "default" | "icon" | "text";
  className?: string;
}

export function TemplateSaveButton({
  templateId,
  initialSaved = false,
  initialCount,
  variant = "default",
  className,
}: TemplateSaveButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const [saved, setSaved] = useState(initialSaved);
  const [count, setCount] = useState(initialCount);

  const saveMutation = useMutation(
    trpc.templates.save.mutationOptions({
      onMutate: async () => {
        // Optimistic update for local state
        const newSaved = !saved;
        setSaved(newSaved);
        setCount((prev) => (newSaved ? prev + 1 : prev - 1));

        // Cancel any outgoing refetches
        await queryClient.cancelQueries({
          queryKey: trpc.templates.getById.queryKey({ templateId }),
        });

        // Snapshot the previous value
        const previousTemplate = queryClient.getQueryData(
          trpc.templates.getById.queryKey({ templateId })
        );

        // Optimistically update to the new value
        if (previousTemplate) {
          queryClient.setQueryData(
            trpc.templates.getById.queryKey({ templateId }),
            {
              ...previousTemplate,
              userSaved: newSaved,
              saveCount: newSaved
                ? previousTemplate.saveCount + 1
                : previousTemplate.saveCount - 1,
            }
          );
        }

        return { previousTemplate };
      },
      onSuccess: (data) => {
        // Update with server data
        setSaved(data.saved);
        setCount(data.saveCount);
        toast.success(data.saved ? "Template saved!" : "Template unsaved");
      },
      onError: (error, _, context) => {
        // Rollback optimistic update
        setSaved(initialSaved);
        setCount(initialCount);

        if (context?.previousTemplate) {
          queryClient.setQueryData(
            trpc.templates.getById.queryKey({ templateId }),
            context.previousTemplate
          );
        }

        toast.error(`Failed to save template: ${error.message}`);
      },
      onSettled: () => {
        // Always refetch after error or success to ensure we're in sync
        queryClient.invalidateQueries({
          queryKey: trpc.templates.getById.queryKey({ templateId }),
        });
      },
    })
  );

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!session) {
      toast.error("Please sign in to save templates", {
        action: {
          label: "Sign In",
          onClick: () => router.push("/auth/signin"),
        },
      });
      return;
    }

    saveMutation.mutate({ templateId });
  };

  if (variant === "icon") {
    return (
      <Button
        size="icon"
        variant="ghost"
        onClick={handleSave}
        className={className}
      >
        <Bookmark
          className={cn(
            "h-4 w-4 transition-colors",
            saved && "fill-yellow-500 text-yellow-500"
          )}
        />
      </Button>
    );
  }

  if (variant === "text") {
    return (
      <button
        onClick={handleSave}
        className={cn(
          "flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
          saved && "text-yellow-600",
          className
        )}
      >
        <Bookmark
          className={cn("h-4 w-4", saved && "fill-yellow-500")}
        />
        <span>{formatNumber(count)}</span>
      </button>
    );
  }

  return (
    <Button
      variant={saved ? "default" : "outline"}
      onClick={handleSave}
      className={className}
    >
      <Bookmark
        className={cn("mr-2 h-4 w-4", saved && "fill-current")}
      />
      {saved ? "Saved" : "Save"}
      <span className="ml-1">({formatNumber(count)})</span>
    </Button>
  );
}

