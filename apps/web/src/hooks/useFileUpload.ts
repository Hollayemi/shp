'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type UploadType = 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';

export interface Upload {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  uploadType: UploadType;
  width?: number;
  height?: number;
  tags: string[];
  description?: string;
  usedInProjects: string[];
  lastUsedAt?: Date;
  createdAt: Date;
}

export interface UseFileUploadOptions {
  uploadType: UploadType;
  teamId?: string;
  onSuccess?: (upload: Upload) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export function useFileUpload(options: UseFileUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { data: session, status } = useSession();

  const uploadFile = async (file: File, overrideOptions?: Partial<UseFileUploadOptions>) => {
    // Merge override options with base options
    const finalOptions = { ...options, ...overrideOptions };
    try {
      setIsUploading(true);
      setProgress(0);

      // Get encrypted chat token
      const tokenResponse = await fetch('/api/get-chat-token');
      const tokenData = await tokenResponse.json();

      if (!tokenData.success || !tokenData.data?.token) {
        throw new Error('Failed to get authentication token');
      }

      // Step 1: Request presigned URL from API
      console.log('Requesting presigned URL for:', {
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        uploadType: finalOptions.uploadType,
      });

      const presignedResponse = await fetch(`${API_BASE_URL}/api/v1/upload/request-presigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-chat-token': tokenData.data.token,
        },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          uploadType: finalOptions.uploadType,
          teamId: finalOptions.teamId,
        }),
      });

      if (!presignedResponse.ok) {
        const errorText = await presignedResponse.text();
        console.error('Failed to get presigned URL:', {
          status: presignedResponse.status,
          statusText: presignedResponse.statusText,
          error: errorText,
        });
        throw new Error(`Failed to request upload: ${presignedResponse.status} ${errorText}`);
      }

      const { data: presignedData } = await presignedResponse.json();
      console.log('Got presigned URL, uploading to R2...');

      setProgress(10);
      finalOptions.onProgress?.(10);

      // Step 2: Upload directly to R2 using XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = 10 + (e.loaded / e.total) * 80; // 10-90%
            setProgress(percentComplete);
            finalOptions.onProgress?.(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            // Get response text for debugging
            let errorDetails = '';
            try {
              errorDetails = xhr.responseText || xhr.statusText;
            } catch (e) {
              errorDetails = 'No response details available';
            }
            console.error('R2 upload failed:', {
              status: xhr.status,
              statusText: xhr.statusText,
              response: errorDetails,
              url: presignedData.presignedUrl.split('?')[0], // Log URL without query params
            });
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText || errorDetails}`));
          }
        });

        xhr.addEventListener('error', (event) => {
          console.error('R2 upload network error:', {
            type: 'network_error',
            readyState: xhr.readyState,
            status: xhr.status,
            file: file.name,
            size: file.size,
          });
          reject(new Error('Network error during upload. Check CORS configuration and R2 credentials.'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('PUT', presignedData.presignedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setProgress(90);
      finalOptions.onProgress?.(90);

      // Step 3: Complete upload
      console.log('Upload to R2 successful, completing upload...');
      
      const completeResponse = await fetch(`${API_BASE_URL}/api/v1/upload/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-chat-token': tokenData.data.token,
        },
        body: JSON.stringify({
          uploadId: presignedData.uploadId,
        }),
      });

      if (!completeResponse.ok) {
        const errorText = await completeResponse.text();
        console.error('Failed to complete upload:', {
          status: completeResponse.status,
          statusText: completeResponse.statusText,
          error: errorText,
        });
        throw new Error(`Failed to complete upload: ${completeResponse.status} ${errorText}`);
      }

      const { data: upload } = await completeResponse.json();
      console.log('Upload completed successfully:', upload.id);

      setProgress(100);
      finalOptions.onProgress?.(100);
      finalOptions.onSuccess?.(upload);

      return upload;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Upload failed');
      finalOptions.onError?.(err);
      throw err;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000); // Reset after 1s
    }
  };

  return {
    uploadFile,
    isUploading,
    progress,
  };
}
