"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Copy, Check, MessageSquare, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface TemplateChatHistoryProps {
  templateId: string;
  className?: string;
  fallbackSeedPrompt?: string;
}

export function TemplateChatHistory({
  templateId,
  className,
  fallbackSeedPrompt,
}: TemplateChatHistoryProps) {
  const trpc = useTRPC();
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...trpc.templates.getChatHistory.queryOptions({ templateId }),
    retry: false, // Don't retry on FORBIDDEN errors
  });

  const handleCopyPrompt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPrompt(true);
      toast.success("Prompt copied to clipboard!");
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      toast.error("Failed to copy prompt");
    }
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // If there's an error but we have a fallback seedPrompt, show it
  if (error && !fallbackSeedPrompt) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <MessageSquare className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
        <p className="text-muted-foreground text-sm">
          Chat history is not available for this template
        </p>
      </div>
    );
  }

  // Use fallback seedPrompt if API call failed or returned no data
  const seedPrompt = data?.seedPrompt || fallbackSeedPrompt;
  const messages = data?.messages || [];

  if (!seedPrompt && messages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <MessageSquare className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
        <p className="text-muted-foreground text-sm">
          No chat history available
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Recipe: How This Was Built</h3>
        <p className="text-muted-foreground text-sm">
          See the conversation that created this template and learn how to
          prompt effectively.
        </p>
      </div>

      {/* Seed Prompt Highlight */}
      {seedPrompt && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-primary flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4" />
              Initial Prompt
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyPrompt(seedPrompt)}
            >
              {copiedPrompt ? (
                <>
                  <Check className="mr-2 h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-sm leading-relaxed">{seedPrompt}</p>
        </Card>
      )}

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className="space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              onCopy={() => handleCopyPrompt(message.content)}
            />
          ))}
        </div>
      )}

      {/* Show message if only seedPrompt is available */}
      {seedPrompt && messages.length === 0 && (
        <div className="bg-muted/30 rounded-lg border border-dashed p-4 text-center">
          <p className="text-muted-foreground text-sm">
            Full chat history is not available, but you can see the initial
            prompt above.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="bg-muted/30 rounded-lg border border-dashed p-4 text-center">
        <p className="text-muted-foreground text-sm">
          💡 Use these prompts as inspiration for your own projects
        </p>
      </div>
    </div>
  );
}

// Chat Message Component (Readonly)
function ChatMessage({
  role,
  content,
  onCopy,
}: {
  role: string;
  content: string;
  onCopy: () => void;
}) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";

  return (
    <div className={cn("group flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
          isUser && "bg-primary text-primary-foreground",
          isAssistant && "bg-purple-500 text-white",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Bubble */}
      <div
        className={cn(
          "relative flex-1 rounded-lg border p-4",
          isUser && "bg-primary/5 border-primary/20",
          isAssistant && "bg-muted/50",
        )}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            {isUser ? "User" : "AI Assistant"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopy}
            className="h-6 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
