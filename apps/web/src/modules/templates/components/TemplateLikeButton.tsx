"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatNumber } from "../lib/utils";

interface TemplateLikeButtonProps {
  templateId: string;
  initialLiked?: boolean;
  initialCount: number;
  variant?: "default" | "icon" | "text";
  className?: string;
}

export function TemplateLikeButton({
  templateId,
  initialLiked = false,
  initialCount,
  variant = "default",
  className,
}: TemplateLikeButtonProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const likeMutation = useMutation(
    trpc.templates.like.mutationOptions({
      onMutate: async () => {
        // Optimistic update for local state
        const newLiked = !liked;
        setLiked(newLiked);
        setCount((prev) => (newLiked ? prev + 1 : prev - 1));

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
              userLiked: newLiked,
              likeCount: newLiked
                ? previousTemplate.likeCount + 1
                : previousTemplate.likeCount - 1,
            }
          );
        }

        return { previousTemplate };
      },
      onSuccess: (data) => {
        // Update with server data
        setLiked(data.liked);
        setCount(data.likeCount);
      },
      onError: (error, _, context) => {
        // Rollback optimistic update
        setLiked(initialLiked);
        setCount(initialCount);

        if (context?.previousTemplate) {
          queryClient.setQueryData(
            trpc.templates.getById.queryKey({ templateId }),
            context.previousTemplate
          );
        }

        toast.error(`Failed to like template: ${error.message}`);
      },
      onSettled: () => {
        // Always refetch after error or success to ensure we're in sync
        queryClient.invalidateQueries({
          queryKey: trpc.templates.getById.queryKey({ templateId }),
        });
      },
    })
  );

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!session) {
      toast.error("Please sign in to like templates", {
        action: {
          label: "Sign In",
          onClick: () => router.push("/auth/signin"),
        },
      });
      return;
    }

    likeMutation.mutate({ templateId });
  };

  if (variant === "icon") {
    return (
      <Button
        size="icon"
        variant="ghost"
        onClick={handleLike}
        className={className}
      >
        <Heart
          className={cn(
            "h-4 w-4 transition-colors",
            liked && "fill-red-500 text-red-500"
          )}
        />
      </Button>
    );
  }

  if (variant === "text") {
    return (
      <button
        onClick={handleLike}
        className={cn(
          "flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
          liked && "text-red-500",
          className
        )}
      >
        <Heart
          className={cn("h-4 w-4", liked && "fill-red-500")}
        />
        <span>{formatNumber(count)}</span>
      </button>
    );
  }

  return (
    <Button
      variant={liked ? "default" : "outline"}
      onClick={handleLike}
      className={className}
    >
      <Heart
        className={cn("mr-2 h-4 w-4", liked && "fill-current")}
      />
      {liked ? "Liked" : "Like"}
      <span className="ml-1">({formatNumber(count)})</span>
    </Button>
  );
}

