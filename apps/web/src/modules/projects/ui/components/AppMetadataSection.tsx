"use client";

import { useDeploymentSettings } from "@/hooks/useDeploymentSettings";
import { useAutofill } from "@/hooks/useAutofill";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AppIconTitle,
  DescriptionInput,
  ShareImageUpload,
  AutofillButton,
} from "./deploy";

interface AppMetadataSectionProps {
  projectId: string;
}

export function AppMetadataSection({ projectId }: AppMetadataSectionProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const {
    title,
    iconUrl,
    description,
    shareImage,
    isLoadingMetadata,
    projectData,
    metadata,
    setTitle,
    setDescription,
    setShareImage,
    handleImageUpload,
    handleIconUpload,
  } = useDeploymentSettings({
    projectId,
    deploymentUrl: undefined,
    isDeploying: false,
    isDeployed: false,
    needsUpdate: false,
    onDeploy: () => {},
    sandboxReady: false,
  });

  // Auto-save mutation
  const updateMetadataMutation = useMutation(
    trpc.projects.updatePublishMetadata.mutationOptions({
      onSuccess: () => {
        toast.success("Auto-saved successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getPublishMetadata.queryKey({ projectId }),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to auto-save");
      },
    }),
  );

  // Auto-save function
  const autoSave = async (updates: {
    title?: string;
    description?: string;
    shareImage?: string | null;
  }) => {
    await updateMetadataMutation.mutateAsync({
      projectId,
      title: updates.title ?? title,
      icon: iconUrl,
      description: updates.description ?? description,
      shareImage: updates.shareImage !== undefined ? (updates.shareImage || undefined) : (shareImage || undefined),
    });
  };

  const {
    generateTitle,
    generateDescription,
    generateSocialImage,
    isGeneratingTitle,
    isGeneratingDescription,
    isGeneratingImage,
  } = useAutofill({
    projectId,
    projectName: projectData?.name,
    onSuccess: (creditsUsed) => {
      console.log(`Used ${creditsUsed} credits`);
    }
  });

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0F1613]" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* App Icon & Title */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
            <div className="text-xs leading-[18px] font-medium text-[#14201F] dark:text-[#F5F9F7]">
              App Icon & Title
            </div>
            <AutofillButton
              onClick={async () => {
                const generatedTitle = await generateTitle(title);
                if (generatedTitle) {
                  setTitle(generatedTitle);
                  // Auto-save the generated title
                  await autoSave({ title: generatedTitle });
                }
              }}
              isLoading={isGeneratingTitle}
              disabled={!projectData}
              context="title"
            />
          </div>
          <AppIconTitle
            title={title}
            iconUrl={iconUrl}
            isLoadingMetadata={isLoadingMetadata}
            projectName={projectData?.name}
            onTitleChange={setTitle}
            onTitleBlur={() => autoSave({ title })}
            onIconUpload={handleIconUpload}
          />
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
            <div className="text-xs leading-[18px] font-medium text-[#14201F] dark:text-[#F5F9F7]">
              Description
            </div>
            <AutofillButton
              onClick={async () => {
                const generatedDescription = await generateDescription(title, description);
                if (generatedDescription) {
                  setDescription(generatedDescription);
                  // Auto-save the generated description
                  await autoSave({ description: generatedDescription });
                }
              }}
              isLoading={isGeneratingDescription}
              disabled={!projectData}
              context="description"
            />
          </div>
          <DescriptionInput
            description={description}
            isLoadingMetadata={isLoadingMetadata}
            onDescriptionChange={setDescription}
            onDescriptionBlur={() => autoSave({ description })}
          />
        </div>

        {/* Social Share Image */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
            <div className="text-xs leading-[18px] font-medium text-[#14201F] dark:text-[#F5F9F7]">
              Social Share Image
            </div>
          </div>
          <ShareImageUpload
            shareImage={shareImage}
            isLoadingMetadata={isLoadingMetadata}
            onImageUpload={handleImageUpload}
            onImageRemove={() => setShareImage(null)}
          />
        </div>
      </div>
    </div>
  );
}
