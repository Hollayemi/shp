"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "../lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TemplateCommentsProps {
  templateId: string;
  className?: string;
}

export function TemplateComments({
  templateId,
  className,
}: TemplateCommentsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const router = useRouter();
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Fetch comments
  const { data, isLoading } = useQuery(
    trpc.templates.getComments.queryOptions({
      templateId,
      limit: 10,
      offset: 0,
    })
  );

  // Add comment mutation
  const addCommentMutation = useMutation(
    trpc.templates.comment.mutationOptions({
      onSuccess: () => {
        toast.success("Comment added!");
        setCommentText("");
        setReplyingTo(null);
        // Invalidate comments query
        queryClient.invalidateQueries({
          queryKey: [["templates", "getComments"]],
        });
      },
      onError: (error) => {
        toast.error(`Failed to add comment: ${error.message}`);
      },
    })
  );

  // Delete comment mutation
  const deleteCommentMutation = useMutation(
    trpc.templates.deleteComment.mutationOptions({
      onSuccess: () => {
        toast.success("Comment deleted");
        queryClient.invalidateQueries({
          queryKey: [["templates", "getComments"]],
        });
      },
      onError: (error) => {
        toast.error(`Failed to delete: ${error.message}`);
      },
    })
  );

  const handleSubmit = () => {
    if (!session) {
      toast.error("Please sign in to comment", {
        action: {
          label: "Sign In",
          onClick: () => router.push("/auth/signin"),
        },
      });
      return;
    }

    if (!commentText.trim()) {
      toast.error("Please enter a comment");
      return;
    }

    if (commentText.length > 2000) {
      toast.error("Comment is too long (max 2000 characters)");
      return;
    }

    addCommentMutation.mutate({
      templateId,
      content: commentText.trim(),
      parentId: replyingTo || undefined,
    });
  };

  const handleDelete = (commentId: string) => {
    if (confirm("Are you sure you want to delete this comment?")) {
      deleteCommentMutation.mutate({ commentId });
    }
  };

  const comments = data?.comments || [];
  const totalComments = data?.pagination.total || 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Comments ({totalComments})
        </h3>
      </div>

      {/* Comment Input */}
      {session ? (
        <div className="space-y-3">
          {replyingTo && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
              <p className="text-sm text-muted-foreground">
                Replying to comment...
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          )}
          
          <div className="space-y-2">
            <Textarea
              placeholder="Share your thoughts about this template..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="min-h-20 resize-none"
              maxLength={2000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {commentText.length} / 2000
              </span>
              <Button
                onClick={handleSubmit}
                disabled={
                  !commentText.trim() ||
                  addCommentMutation.isPending ||
                  commentText.length > 2000
                }
              >
                {addCommentMutation.isPending ? (
                  <>Posting...</>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Post Comment
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Sign in to share your thoughts
          </p>
          <Button variant="outline" onClick={() => router.push("/auth/signin")}>
            Sign In to Comment
          </Button>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No comments yet. Be the first to share your thoughts!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              onDelete={handleDelete}
              onReply={setReplyingTo}
              currentUserId={session?.user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Comment Component
function Comment({
  comment,
  onDelete,
  onReply,
  currentUserId,
  isReply = false,
}: {
  comment: any;
  onDelete: (id: string) => void;
  onReply: (id: string) => void;
  currentUserId?: string;
  isReply?: boolean;
}) {
  const canDelete = currentUserId === comment.userId || comment.user?.role === "ADMIN";

  return (
    <div className={cn("space-y-3", isReply && "ml-12")}>
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.user?.image || undefined} />
          <AvatarFallback>
            {comment.user?.name?.[0] || "U"}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {comment.user?.name || "Anonymous"}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(comment.id)}
                className="h-6 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Reply button (future feature) */}
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply(comment.id)}
              className="h-7 text-xs"
            >
              Reply
            </Button>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {comment.replies.map((reply: any) => (
            <Comment
              key={reply.id}
              comment={reply}
              onDelete={onDelete}
              onReply={onReply}
              currentUserId={currentUserId}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Comment Skeleton
function CommentSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

