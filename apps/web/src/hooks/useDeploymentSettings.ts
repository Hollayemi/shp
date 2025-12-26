"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface UseDeploymentSettingsProps {
  projectId: string;
  deploymentUrl?: string;
  isDeploying: boolean;
  isDeployed: boolean;
  needsUpdate?: boolean;
  onDeploy: (subdomain?: string) => void;
  sandboxReady?: boolean;
  deployedAt?: Date;
  initialCollapsibleState?: {
    isDomainOpen?: boolean;
    isIconTitleOpen?: boolean;
    isDescriptionOpen?: boolean;
    isShareImageOpen?: boolean;
  };
}

export function useDeploymentSettings({
  projectId,
  deploymentUrl,
  isDeploying,
  isDeployed,
  needsUpdate = false,
  onDeploy,
  sandboxReady,
  deployedAt,
  initialCollapsibleState,
}: UseDeploymentSettingsProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Form state
  const [subdomain, setSubdomain] = useState("");
  const [title, setTitle] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [iconFile, setIconFile] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [shareImage, setShareImage] = useState<string | null>(null);

  // UI state
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(
    null,
  );
  const [subdomainError, setSubdomainError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [debouncedSubdomain, setDebouncedSubdomain] = useState("");
  const [hasInitializedMetadata, setHasInitializedMetadata] = useState(false);
  const [hasSetInitialSubdomain, setHasSetInitialSubdomain] = useState(false);
  const [initialSubdomain, setInitialSubdomain] = useState("");

  // Collapsible state
  const [isDomainOpen, setIsDomainOpen] = useState(initialCollapsibleState?.isDomainOpen ?? true);
  const [isIconTitleOpen, setIsIconTitleOpen] = useState(initialCollapsibleState?.isIconTitleOpen ?? true);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(initialCollapsibleState?.isDescriptionOpen ?? true);
  const [isShareImageOpen, setIsShareImageOpen] = useState(initialCollapsibleState?.isShareImageOpen ?? true);

  // Get project data for name
  const { data: projectData } = useQuery({
    ...trpc.projects.getOne.queryOptions({
      projectId,
    }),
    enabled: !!projectId,
  });

  // Get publish metadata
  const {
    data: metadata,
    refetch,
    isLoading: isLoadingMetadata,
  } = useQuery({
    ...trpc.projects.getPublishMetadata.queryOptions({
      projectId,
    }),
    retry: false,
    enabled: !!projectId && !!sandboxReady,
  });
 
  // Update metadata mutation
  const updateMetadataMutation = useMutation(
    trpc.projects.updatePublishMetadata.mutationOptions({
      onSuccess: () => {
        toast.success("Website info updated successfully!");
        setIsSaving(false);
        setIsEditingUrl(false);
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getPublishMetadata.queryKey({ projectId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getOne.queryKey({ projectId }),
        });
        refetch();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update website info");
        setIsSaving(false);
      },
    }),
  );

  // Update project name mutation
  const updateProjectNameMutation = useMutation(
    trpc.projects.updateName.mutationOptions({
      onSuccess: () => {
        // Invalidate project queries to sync across all components
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getOne.queryKey({ projectId }),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update project name");
      },
    }),
  );

  // Initialize form when metadata loads and update when it changes
  
  useEffect(() => {
    if (metadata) {
      // Reset icon to default shipper favicon icon
      metadata.icon = '/favicon_shipper.png';
      setTitle(metadata.title || "");
      setIconUrl(metadata.icon || "");
      setDescription(metadata.description || "");
      // Only set shareImage if it's a base64 data URL (not a path)
      if (metadata.shareImage && metadata.shareImage.startsWith("data:")) {
        setShareImage(metadata.shareImage);
      } else if (!metadata.shareImage) {
        // Clear shareImage if metadata doesn't have one
        setShareImage(null);
      }
      setHasInitializedMetadata(true);
    }
  }, [metadata]);

  // Initialize subdomain from project.subdomain field or project name
  useEffect(() => {
    if (!hasSetInitialSubdomain && projectData) {
      let extractedSubdomain = "";

      // Use the subdomain field from the project (the actual Shipper subdomain)
      if (projectData.subdomain) {
        extractedSubdomain = projectData.subdomain;
      }
      // If no subdomain field, use project name as fallback
      else if (projectData.name) {
        extractedSubdomain = projectData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .substring(0, 63);
      }

      if (extractedSubdomain) {
        setSubdomain(extractedSubdomain);
        setInitialSubdomain(extractedSubdomain);
        setHasSetInitialSubdomain(true);
      }
    }
  }, [projectData, hasSetInitialSubdomain]);

  // Debounce subdomain value
  useEffect(() => {
    const timer = setTimeout(() => {
      if (subdomain && isEditingUrl) {
        setDebouncedSubdomain(subdomain);
      } else {
        setDebouncedSubdomain("");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [subdomain, isEditingUrl]);

  // Query subdomain availability
  const { data: availabilityData, isLoading: isCheckingSubdomain } = useQuery({
    ...trpc.projects.checkSubdomainAvailability.queryOptions({
      subdomain: debouncedSubdomain,
      projectId,
    }),
    enabled: !!debouncedSubdomain && debouncedSubdomain.length >= 3,
  });

  // Update validation state based on query result
  useEffect(() => {
    if (!debouncedSubdomain) {
      setSubdomainAvailable(null);
      setSubdomainError("");
      return;
    }

    if (debouncedSubdomain.length < 3) {
      setSubdomainAvailable(null);
      setSubdomainError("Subdomain must be at least 3 characters");
      return;
    }

    if (availabilityData) {
      setSubdomainAvailable(availabilityData.available);
      setSubdomainError(
        availabilityData.available ? "" : "This subdomain is already taken",
      );
    }
  }, [debouncedSubdomain, availabilityData]);

  // Sanitize subdomain input
  const handleSubdomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "") // Allow letters, numbers, and dashes
      .replace(/^-+/, "") // Remove leading dashes only (but allow trailing while typing)
      .substring(0, 63);
    setSubdomain(value);
    setIsEditingUrl(true); // Enable editing mode when user types
  };

  // Handle click on URL input - open deployment URL if deployed and not editing
  const handleUrlClick = (e: React.MouseEvent) => {
    if (deploymentUrl && !isEditingUrl) {
      e.preventDefault();
      window.open(deploymentUrl, "_blank");
    }
  };

  // Handle focus on URL input - prevent focus if deployed and not editing
  const handleUrlFocus = (e: React.FocusEvent) => {
    if (deploymentUrl && !isEditingUrl) {
      e.preventDefault();
      window.open(deploymentUrl, "_blank");
    }
  };

  // Handle edit icon click - enable URL editing
  const handleEditUrlClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingUrl(true);
  };

  // Handle blur on URL input - exit editing mode when user finishes
  const handleUrlBlur = () => {
    // If the user blurs while the subdomain is invalid, revert it.
    if (subdomain && subdomainAvailable === false) {
      setSubdomain(initialSubdomain);
      setSubdomainError("");
    }
    setIsEditingUrl(false);
  };

  const handleReset = () => {
    // Reset subdomain: use deployed subdomain if exists, otherwise project name
    if (deploymentUrl) {
      try {
        const url = new URL(deploymentUrl);
        const hostname = url.hostname;
        // Extract subdomain from hostname (e.g., "my-app.shipper.now" -> "my-app")
        const deployedSubdomain = hostname.split(".")[0];
        setSubdomain(deployedSubdomain);
      } catch (e) {
        console.warn("Failed to parse deployment URL:", e);
        // Fallback to project name if URL parsing fails
        if (projectData) {
          const defaultSubdomain = projectData.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 63);
          setSubdomain(defaultSubdomain);
        }
      }
    } else if (projectData) {
      // No deployment yet, use project name
      const defaultSubdomain = projectData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 63);
      setSubdomain(defaultSubdomain);
    }

    // Reset other metadata fields
    if (metadata) {
      // Reset icon to default shipper favicon icon
      metadata.icon = '/favicon_shipper.png';
      setTitle(metadata.title || "");
      setIconUrl(metadata.icon || "");
      setIconFile(null);
      setDescription(metadata.description || "");
      // Restore shareImage from metadata if it's a base64 data URL
      if (metadata.shareImage && metadata.shareImage.startsWith("data:")) {
        setShareImage(metadata.shareImage);
      } else {
        setShareImage(null);
      }
    }
    setIsEditingUrl(false);
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    if (!metadata) return false;

    // Get the current deployed subdomain or fall back to project name
    let currentSubdomain = "";
    if (deploymentUrl) {
      try {
        const url = new URL(deploymentUrl);
        const hostname = url.hostname;
        currentSubdomain = hostname.split(".")[0];
      } catch (e) {
        // If parsing fails, fall back to project name
        currentSubdomain = projectData?.name
          ? projectData.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")
              .substring(0, 63)
          : "";
      }
    } else {
      // No deployment yet, use project name
      currentSubdomain = projectData?.name
        ? projectData.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .substring(0, 63)
        : "";
    }

    return (
      title !== (metadata.title || "") ||
      iconUrl !== (metadata.icon || "") ||
      iconFile !== null ||
      description !== (metadata.description || "") ||
      subdomain !== currentSubdomain ||
      shareImage !== (metadata.shareImage || null)
    );
  };

  const handlePublishWithMetadata = async () => {
    // Check if subdomain is available before publishing
    if (isEditingUrl && subdomain && !subdomainAvailable) {
      toast.error(subdomainError || "Please choose an available subdomain");
      return;
    }

    console.log(
      "[useDeploymentSettings] Publishing with subdomain:",
      subdomain,
    );

    // Check if subdomain has changed from initial value
    const hasSubdomainChanged = subdomain !== initialSubdomain;

    // First save metadata if there are changes (excluding subdomain)
    const hasMetadataChanges =
      title !== (metadata?.title || "") ||
      iconUrl !== (metadata?.icon || "") ||
      iconFile !== null ||
      description !== (metadata?.description || "") ||
      shareImage !== (metadata?.shareImage || null);

    setIsSaving(true);
    try {
      // Update project name if subdomain has changed
      if (hasSubdomainChanged && subdomain) {
        console.log(
          "[useDeploymentSettings] Updating project name to:",
          subdomain,
        );
        await updateProjectNameMutation.mutateAsync({
          projectId,
          name: subdomain,
        });
        // Update the initial subdomain to the new value
        setInitialSubdomain(subdomain);
      }

      // Update metadata if there are changes
      if (hasMetadataChanges) {
        await updateMetadataMutation.mutateAsync({
          projectId,
          title,
          icon: iconFile || iconUrl,
          description,
          shareImage: shareImage || undefined,
        });
      }

      // After successful save, trigger deploy with subdomain
      setIsSaving(false);
      console.log(
        "[useDeploymentSettings] Calling onDeploy with subdomain:",
        subdomain,
      );
      onDeploy(subdomain);
    } catch (error) {
      setIsSaving(false);
      // Error is already handled by mutation's onError
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setShareImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 512 * 1024) {
        toast.error("Icon must be less than 512KB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setIconFile(result);
        setIconUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  return {
    // State
    subdomain,
    title,
    iconUrl,
    iconFile,
    description,
    shareImage,
    isEditingUrl,
    subdomainAvailable,
    subdomainError,
    isSaving,
    isCheckingSubdomain,
    isLoadingMetadata,
    hasSetInitialSubdomain,
    projectData,
    metadata,
    // Collapsible state
    isDomainOpen,
    setIsDomainOpen,
    isIconTitleOpen,
    setIsIconTitleOpen,
    isDescriptionOpen,
    setIsDescriptionOpen,
    isShareImageOpen,
    setIsShareImageOpen,
    // Setters
    setTitle,
    setDescription,
    setShareImage,
    setIsEditingUrl,
    // Handlers
    handleSubdomainChange,
    handleUrlClick,
    handleUrlFocus,
    handleUrlBlur,
    handleEditUrlClick,
    handleReset,
    handlePublishWithMetadata,
    handleImageUpload,
    handleIconUpload,
    hasUnsavedChanges,
    // Computed
    isDeploying,
    isDeployed,
    needsUpdate,
    deploymentUrl,
    sandboxReady,
  };
}

