import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 Configuration
const R2_CONFIG = {
  BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'shipper-uploads',
  PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
  ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
  ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
  SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  REGION: 'auto', // R2 uses 'auto' region
};

export type UploadType = 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';

export class R2Client {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({
      region: R2_CONFIG.REGION,
      endpoint: `https://${R2_CONFIG.ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_CONFIG.ACCESS_KEY_ID,
        secretAccessKey: R2_CONFIG.SECRET_ACCESS_KEY,
      },
    });
    this.bucket = R2_CONFIG.BUCKET_NAME;
  }

  /**
   * Generate presigned URL for direct client upload
   */
  async generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresIn: number = 3600 // 1 hour
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Upload file directly (server-side)
   */
  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | string,
    mimeType: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      Metadata: metadata,
    });

    await this.client.send(command);
  }

  /**
   * Delete file
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get public URL for file
   */
  getPublicUrl(key: string): string {
    return `${R2_CONFIG.PUBLIC_URL}/${key}`;
  }

  /**
   * Generate storage key with organization
   * Format: {type}/users/{userId}/{timestamp}-{randomId}-{filename}
   * Or: {type}/teams/{teamId}/{timestamp}-{randomId}-{filename}
   */
  static generateStorageKey(
    uploadType: UploadType,
    userId: string,
    filename: string,
    teamId?: string
  ): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);

    // Sanitize filename
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Organize by type and ownership
    const parts = [uploadType.toLowerCase()];

    if (teamId) {
      parts.push('teams', teamId);
    } else {
      parts.push('users', userId);
    }

    // Add timestamp and random ID for uniqueness
    parts.push(`${timestamp}-${randomId}-${sanitized}`);

    return parts.join('/');
  }
}
