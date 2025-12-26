// src/components/improved-loading/SandboxLoadingManager.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Zap,
  FileCode,
  Server,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SandboxLoadingState {
  phase: "idle" | "initializing" | "creating" | "restoring" | "ready" | "error";
  message: string;
  progress: number;
  details?: string;
  error?: string;
  canRetry?: boolean;
}

interface SandboxLoadingManagerProps {
  isLoading: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
  compact?: boolean;
}

const LOADING_PHASES = {
  idle: {
    icon: Server,
    label: "Idle",
    description: "Waiting to start...",
    color: "text-gray-500",
  },
  initializing: {
    icon: Server,
    label: "Initializing",
    description: "Preparing your development environment...",
    color: "text-blue-500",
  },
  creating: {
    icon: Zap,
    label: "Creating Sandbox",
    description: "Spinning up a secure cloud container...",
    color: "text-purple-500",
  },
  restoring: {
    icon: FileCode,
    label: "Restoring Files",
    description: "Loading your project files and dependencies...",
    color: "text-green-500",
  },
  ready: {
    icon: CheckCircle,
    label: "Ready",
    description: "Your development environment is ready!",
    color: "text-green-600",
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    description: "Something went wrong with the sandbox setup",
    color: "text-red-500",
  },
};

export function SandboxLoadingManager({
  isLoading,
  onRetry,
  onCancel,
  className,
  compact = false,
}: SandboxLoadingManagerProps) {
  const [loadingState, setLoadingState] = useState<SandboxLoadingState>({
    phase: "idle",
    message: "",
    progress: 0,
  });

  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Simulate realistic loading phases
  useEffect(() => {
    if (!isLoading) {
      setLoadingState({ phase: "idle", message: "", progress: 0 });
      setStartTime(null);
      setElapsedTime(0);
      return;
    }

    setStartTime(new Date());
    let currentPhase = 0;
    const phases = ["initializing", "creating", "restoring"] as const;

    // Phase 1: Initializing (0-20%)
    setLoadingState({
      phase: "initializing",
      message: "Preparing sandbox environment...",
      progress: 5,
      details: "Checking resources and permissions",
    });

    const progressInterval = setInterval(() => {
      setLoadingState((prev) => {
        if (prev.phase === "error" || prev.phase === "ready") {
          clearInterval(progressInterval);
          return prev;
        }

        let newProgress = prev.progress + Math.random() * 3 + 1;
        let newPhase: SandboxLoadingState["phase"] = prev.phase;
        let newMessage = prev.message;
        let newDetails = prev.details;

        // Phase transitions
        if (newProgress > 25 && currentPhase === 0) {
          currentPhase = 1;
          newPhase = "creating";
          newMessage = "Creating secure sandbox...";
          newDetails = "Allocating compute resources and setting up isolation";
        } else if (newProgress > 60 && currentPhase === 1) {
          currentPhase = 2;
          newPhase = "restoring";
          newMessage = "Restoring project files...";
          newDetails = "Loading code files and installing dependencies";
        } else if (newProgress > 95) {
          clearInterval(progressInterval);
          newPhase = "ready";
          newMessage = "Sandbox ready!";
          newDetails = "Development environment is fully loaded";
          newProgress = 100;
        }

        return {
          ...prev,
          phase: newPhase,
          message: newMessage,
          progress: Math.min(newProgress, 98), // Cap at 98% until actually ready
          details: newDetails,
        };
      });
    }, 200 + Math.random() * 300); // Vary timing for realism

    return () => clearInterval(progressInterval);
  }, [isLoading]);

  // Track elapsed time
  useEffect(() => {
    if (!startTime) return;

    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  if (!isLoading && loadingState.phase === "idle") {
    return null;
  }

  const currentPhaseInfo = LOADING_PHASES[loadingState.phase];

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-2 bg-muted/50 rounded-md",
          className
        )}
      >
        <currentPhaseInfo.icon
          className={cn("h-4 w-4 animate-spin", currentPhaseInfo.color)}
        />
        <span className="text-sm font-medium">{loadingState.message}</span>
        <Badge variant="secondary" className="text-xs">
          {loadingState.progress.toFixed(0)}%
        </Badge>
      </div>
    );
  }

  return (
    <Card className={cn("w-full max-w-md mx-auto", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <currentPhaseInfo.icon
            className={cn(
              "h-5 w-5",
              currentPhaseInfo.color,
              loadingState.phase !== "ready" &&
              loadingState.phase !== "error" &&
              "animate-spin"
            )}
          />
          {currentPhaseInfo.label}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{loadingState.message}</span>
            <span className="text-muted-foreground">
              {loadingState.progress.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-300 ease-out",
                loadingState.phase === "error" ? "bg-red-500" : "bg-blue-500"
              )}
              style={{ width: `${loadingState.progress}%` }}
            />
          </div>
        </div>

        {/* Details */}
        {loadingState.details && (
          <p className="text-sm text-muted-foreground">
            {loadingState.details}
          </p>
        )}

        {/* Elapsed Time */}
        {elapsedTime > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Elapsed: {elapsedTime}s</span>
            <span>
              {loadingState.phase === "ready" ? "Completed" : "In progress..."}
            </span>
          </div>
        )}

        {/* Error State */}
        {loadingState.phase === "error" && (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                {loadingState.error ||
                  "Failed to create sandbox. This might be due to high demand or a temporary issue."}
              </p>
            </div>

            <div className="flex gap-2">
              {onRetry && (
                <Button
                  onClick={onRetry}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
              {onCancel && (
                <Button
                  onClick={onCancel}
                  size="sm"
                  variant="ghost"
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Ready State */}
        {loadingState.phase === "ready" && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-800 font-medium">
                Sandbox is ready! You can now preview and edit your project.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for managing sandbox loading state
export function useSandboxLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startLoading = () => {
    setIsLoading(true);
    setError(null);
  };

  const stopLoading = () => {
    setIsLoading(false);
  };

  const setLoadingError = (errorMessage: string) => {
    setError(errorMessage);
    setIsLoading(false);
  };

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setLoadingError,
  };
}

// Enhanced Fragment Loading Component
interface FragmentLoadingProps {
  isLoading: boolean;
  fragmentTitle?: string;
  fileCount?: number;
  onRetry?: () => void;
}

export function FragmentLoading({
  isLoading,
  fragmentTitle,
  fileCount,
  onRetry,
}: FragmentLoadingProps) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <FileCode className="absolute inset-0 m-auto w-6 h-6 text-blue-600" />
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          Loading {fragmentTitle || "Fragment"}
          {dots}
        </h3>
        <p className="text-muted-foreground">
          {fileCount ? `Restoring ${fileCount} files` : "Preparing your code"}
        </p>
      </div>

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}

// Agent Generation Loading Component
const GENERATION_MESSAGES = [
  "Analyzing your request...",
  "Planning the solution...",
  "Generating code structure...",
  "Implementing features...",
  "Adding styling and interactions...",
  "Testing and optimizing...",
  "Finalizing your application...",
];

interface AgentGenerationLoadingProps {
  phase?: string;
  totalPhases?: number;
  currentPhase?: number;
}

export function AgentGenerationLoading({
  phase = "Thinking",
  totalPhases = 4,
  currentPhase = 1,
}: AgentGenerationLoadingProps) {
  const [message, setMessage] = useState("Analyzing your request...");



  useEffect(() => {
    let messageIndex = 0;
    const interval = setInterval(() => {
      setMessage(GENERATION_MESSAGES[messageIndex % GENERATION_MESSAGES.length]);
      messageIndex++;
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-6">
      <div className="relative">
        <div className="w-12 h-12 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className="w-5 h-5 text-purple-600" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">{phase}</h3>
        <p className="text-muted-foreground max-w-xs">{message}</p>
      </div>

      {/* Phase Progress */}
      <div className="flex items-center space-x-2">
        {Array.from({ length: totalPhases }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              i < currentPhase ? "bg-purple-600" : "bg-gray-300"
            )}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Phase {currentPhase} of {totalPhases}
      </p>
    </div>
  );
}
