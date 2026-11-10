import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import { logger } from "../../infrastructure/logging/logger.js";

export interface PresignedUploadParams {
  fileKey: string;
  mimeType: string;
  fileSize?: number;
  expiresInSeconds?: number;
}

export interface PresignedDownloadParams {
  fileKey: string;
  expiresInSeconds?: number;
}

export interface ObjectMetadata {
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  etag?: string;
}

export interface StoragePort {
  readonly isLiveR2: boolean;
  generatePresignedUploadUrl(params: PresignedUploadParams): Promise<{ uploadUrl: string; expiresInSeconds: number }>;
  generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<string>;
  deleteObject(fileKey: string): Promise<void>;
  objectExists(fileKey: string): Promise<boolean>;
  getObjectMetadata(fileKey: string): Promise<ObjectMetadata>;
  getPublicUrl?(fileKey: string): string | undefined;
  simulateUpload?(fileKey: string, data: { mimeType?: string; size?: number }): void;
}

export class CloudflareR2StorageAdapter implements StoragePort {
  readonly isLiveR2 = true;
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl?: string;

  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl?: string;
  }) {
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }

  async generatePresignedUploadUrl(params: PresignedUploadParams): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
    const expiresIn = params.expiresInSeconds || env.R2_PRESIGNED_TTL_SECONDS || 900;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: params.fileKey,
      ContentType: params.mimeType,
      ...(params.fileSize ? { ContentLength: params.fileSize } : {})
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return { uploadUrl, expiresInSeconds: expiresIn };
  }

  async generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<string> {
    const expiresIn = params.expiresInSeconds || env.R2_PRESIGNED_TTL_SECONDS || 900;
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: params.fileKey
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey
    });
    await this.client.send(command);
  }

  async getObjectMetadata(fileKey: string): Promise<ObjectMetadata> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey
      });
      const res = await this.client.send(command);
      return {
        exists: true,
        contentLength: res.ContentLength,
        contentType: res.ContentType,
        etag: res.ETag
      };
    } catch {
      return { exists: false };
    }
  }

  async objectExists(fileKey: string): Promise<boolean> {
    const meta = await this.getObjectMetadata(fileKey);
    return meta.exists;
  }

  getPublicUrl(fileKey: string): string | undefined {
    if (!this.publicUrl) return undefined;
    return `${this.publicUrl.replace(/\/$/, "")}/${fileKey}`;
  }
}

export class InMemoryStorageAdapter implements StoragePort {
  readonly isLiveR2 = false;
  private readonly storedObjects = new Map<string, { mimeType: string; size: number; createdAt: Date }>();
  private readonly baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async generatePresignedUploadUrl(params: PresignedUploadParams): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
    const expiresIn = params.expiresInSeconds || 900;
    const uploadUrl = `${this.baseUrl}/api/v1/uploads/mock-storage/${encodeURIComponent(params.fileKey)}?signature=mock-presigned-sig&expiresIn=${expiresIn}`;
    return { uploadUrl, expiresInSeconds: expiresIn };
  }

  simulateUpload(fileKey: string, data: { mimeType?: string; size?: number }): void {
    this.storedObjects.set(fileKey, {
      mimeType: data.mimeType !== undefined ? data.mimeType : "",
      size: data.size !== undefined ? data.size : 0,
      createdAt: new Date()
    });
  }

  async generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<string> {
    const expiresIn = params.expiresInSeconds || 900;
    return `${this.baseUrl}/api/v1/uploads/mock-storage/${encodeURIComponent(params.fileKey)}?token=mock-read-token&expiresIn=${expiresIn}`;
  }

  async deleteObject(fileKey: string): Promise<void> {
    this.storedObjects.delete(fileKey);
  }

  async getObjectMetadata(fileKey: string): Promise<ObjectMetadata> {
    const obj = this.storedObjects.get(fileKey);
    if (!obj) {
      return { exists: false };
    }
    return {
      exists: true,
      contentLength: obj.size,
      contentType: obj.mimeType && obj.mimeType.trim().length > 0 ? obj.mimeType : undefined
    };
  }

  async objectExists(fileKey: string): Promise<boolean> {
    return this.storedObjects.has(fileKey);
  }

  getPublicUrl(fileKey: string): string | undefined {
    return `${this.baseUrl}/uploads/public/${fileKey}`;
  }
}

export function createStorageService(): StoragePort {
  const isProduction = env.NODE_ENV === "production";
  const hasR2Creds = Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME
  );

  if (isProduction) {
    if (!hasR2Creds || env.STORAGE_PROVIDER !== "r2") {
      throw new Error(
        "[StorageService] Fatal: Cloudflare R2 credentials are required in production (STORAGE_PROVIDER must be 'r2'). Ephemeral InMemoryStorageAdapter is strictly prohibited."
      );
    }
    logger.info({ bucket: env.R2_BUCKET_NAME }, "[StorageService] Initialized Cloudflare R2 storage adapter");
    return new CloudflareR2StorageAdapter({
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucketName: env.R2_BUCKET_NAME!,
      publicUrl: env.R2_PUBLIC_URL
    });
  }

  if (env.STORAGE_PROVIDER === "r2" && hasR2Creds) {
    logger.info({ bucket: env.R2_BUCKET_NAME }, "[StorageService] Initialized Cloudflare R2 storage adapter (non-production)");
    return new CloudflareR2StorageAdapter({
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucketName: env.R2_BUCKET_NAME!,
      publicUrl: env.R2_PUBLIC_URL
    });
  }

  logger.warn(
    "[StorageService] Ephemeral storage warning: Initialized InMemoryStorageAdapter for local development/testing."
  );
  return new InMemoryStorageAdapter(env.APP_PUBLIC_URL || `http://${env.HOST}:${env.PORT}`);
}

export const storageService = createStorageService();

