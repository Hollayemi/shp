import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";

interface SandboxHealthOptions {
  projectId: string;
  enabled?: boolean;
  pollInterval?: number;
  onHealthChange?: (isHealthy: boolean, details: any) => void;
}

export function useSandboxHealth({ 
  projectId, 
  enabled = true, 
  pollInterval = 0, // Default to no polling - use manual refresh
  onHealthChange 
}: SandboxHealthOptions) {
  const trpc = useTRPC();
  const lastHealthStatus = useRef<boolean | null>(null);
  
  const { data: healthStatus, refetch, isLoading } = useQuery({
    ...trpc.projects.checkProjectSandboxHealth.queryOptions({ projectId }),
    enabled,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: false,
    staleTime: 30000, // Cache for 30 seconds to prevent redundant calls
    gcTime: 60000, // Keep in cache for 1 minute
  });

  // Memoized health check trigger
  const checkHealth = useCallback(async () => {
    return await refetch();
  }, [refetch]);

  // Health change notification
  useEffect(() => {
    if (healthStatus && healthStatus.isHealthy !== lastHealthStatus.current) {
      lastHealthStatus.current = healthStatus.isHealthy;
      onHealthChange?.(healthStatus.isHealthy, healthStatus);
    }
  }, [healthStatus, onHealthChange]);

  return {
    isHealthy: healthStatus?.isHealthy ?? false,
    needsRefresh: healthStatus?.needsRefresh ?? false,
    hasActiveSandbox: healthStatus?.hasActiveSandbox ?? false,
    sandboxId: healthStatus?.sandboxId ?? null,
    sandboxUrl: (healthStatus as any)?.sandboxUrl ?? null, // deprecated field
    timeUntilExpiration: (healthStatus as any)?.timeUntilExpiration ?? null, // deprecated field
    isLoading,
    checkHealth, // Manual health check
    refetch // Keep for backward compatibility
  };
}