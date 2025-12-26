'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to get chat token
async function getChatToken() {
  const tokenResponse = await fetch('/api/get-chat-token');
  const tokenData = await tokenResponse.json();
  if (!tokenData.success || !tokenData.data?.token) {
    throw new Error('Failed to get authentication token');
  }
  return tokenData.data.token;
}

export type UploadType = 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';

export interface UseMediaLibraryOptions {
  uploadType?: UploadType;
  tags?: string[];
  search?: string;
  limit?: number;
}

export function useMediaLibrary(options: UseMediaLibraryOptions = {}) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['uploads', 'library', options],
    queryFn: async ({ pageParam }) => {
      const token = await getChatToken();
      const params = new URLSearchParams();
      if (options.uploadType) params.set('uploadType', options.uploadType);
      if (options.tags?.length) params.set('tags', options.tags.join(','));
      if (options.search) params.set('search', options.search);
      if (pageParam) params.set('cursor', pageParam);
      params.set('limit', String(options.limit || 20));

      const response = await fetch(`${API_BASE_URL}/api/v1/upload/library?${params}`, {
        headers: {
          'x-chat-token': token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch library');
      }

      const result = await response.json();
      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!session?.user?.id,
  });

  const uploads = data?.pages.flatMap((page) => page.uploads) ?? [];

  const deleteUploadMutation = useMutation({
    mutationFn: async (uploadId: string) => {
      const token = await getChatToken();
      const response = await fetch(`${API_BASE_URL}/api/v1/upload/${uploadId}`, {
        method: 'DELETE',
        headers: {
          'x-chat-token': token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete upload');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads', 'library'] });
    },
  });

  const updateMetadataMutation = useMutation({
    mutationFn: async ({ uploadId, tags, description }: { uploadId: string; tags?: string[]; description?: string }) => {
      const token = await getChatToken();
      const response = await fetch(`${API_BASE_URL}/api/v1/upload/metadata`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-chat-token': token,
        },
        body: JSON.stringify({ uploadId, tags, description }),
      });

      if (!response.ok) {
        throw new Error('Failed to update metadata');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads', 'library'] });
    },
  });

  return {
    uploads,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    deleteUpload: (uploadId: string) => deleteUploadMutation.mutateAsync(uploadId),
    updateMetadata: (uploadId: string, tags?: string[], description?: string) =>
      updateMetadataMutation.mutateAsync({ uploadId, tags, description }),
  };
}
