import { useState } from 'react';
import { toast } from 'sonner';
import { useTRPC } from '@/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UseAutofillOptions {
  projectId: string;
  projectName?: string;
  onSuccess?: (creditsUsed: number) => void;
  autoSave?: boolean; // Whether to automatically save to database
}

export function useAutofill({ projectId, projectName, onSuccess, autoSave = true }: UseAutofillOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Mutation to save metadata
  const updateMetadataMutation = useMutation(
    trpc.projects.updatePublishMetadata.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.projects.getPublishMetadata.queryKey({ projectId })
        });
      }
    })
  );

  const generateTitle = async (currentTitle?: string) => {
    setIsGeneratingTitle(true);
    try {
      console.log('[Autofill] Generating title...', { projectId, projectName, currentTitle });
      
      const response = await fetch('/api/ai/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectName: projectName || 'My App',
          currentTitle,
          context: 'web-app'
        })
      });

      console.log('[Autofill] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Autofill] Error response:', errorData);
        throw new Error(errorData.error || 'Failed to generate title');
      }

      const data = await response.json();
      console.log('[Autofill] Success response:', data);
      
      if (data.success) {
        onSuccess?.(data.creditsUsed);
        console.log('[Autofill] Returning title:', data.generatedTitle);
        
        // Auto-save to database if enabled
        if (autoSave) {
          await updateMetadataMutation.mutateAsync({
            projectId,
            title: data.generatedTitle
          });
        }
        
        return data.generatedTitle;
      } else {
        throw new Error(data.error || 'Failed to generate title');
      }
    } catch (error) {
      console.error('[Autofill] Failed to generate title:', error);
      toast.error('Failed to generate title', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
      return null;
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const generateDescription = async (title?: string, currentDescription?: string) => {
    setIsGeneratingDescription(true);
    try {
      const response = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectName: projectName || 'My App',
          title,
          currentDescription
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();
      
      if (data.success) {
        onSuccess?.(data.creditsUsed);
        
        // Auto-save to database if enabled
        if (autoSave) {
          await updateMetadataMutation.mutateAsync({
            projectId,
            description: data.generatedDescription
          });
        }
        
        return data.generatedDescription;
      } else {
        throw new Error(data.error || 'Failed to generate description');
      }
    } catch (error) {
      console.error('Failed to generate description:', error);
      toast.error('Failed to generate description', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
      return null;
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const generateSocialImage = async (title?: string, description?: string) => {
    setIsGeneratingImage(true);
    try {
      const response = await fetch('/api/ai/generate-social-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          projectName: projectName || 'My App',
          title,
          description
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      
      if (data.success) {
        toast.success('Social image generated successfully!');
        onSuccess?.(data.creditsUsed);
        
        // Auto-save to database if enabled
        if (autoSave) {
          await updateMetadataMutation.mutateAsync({
            projectId,
            shareImage: data.imageUrl
          });
        }
        
        return data.imageUrl;
      } else {
        throw new Error(data.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      toast.error('Failed to generate social image', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
      return null;
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return {
    generateTitle,
    generateDescription,
    generateSocialImage,
    isGeneratingTitle,
    isGeneratingDescription,
    isGeneratingImage,
  };
}
