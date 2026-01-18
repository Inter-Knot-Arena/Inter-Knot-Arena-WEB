import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PresignedUpload, PresignOptions, StorageClient } from "./types.js";

interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicUrl?: string;
  presignExpiresSec: number;
}

export function createS3Storage(): StorageClient {
  const config = readConfig();
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
  return new S3Storage(client, config);
}

class S3Storage implements StorageClient {
  constructor(
    private readonly client: S3Client,
    private readonly config: S3Config
  ) {}

  async getPresignedUpload(options: PresignOptions): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: options.key,
      ContentType: options.contentType
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.config.presignExpiresSec
    });
    const publicUrl = this.getPublicUrl(options.key) ?? undefined;
    return {
      key: options.key,
      uploadUrl,
      publicUrl,
      expiresIn: this.config.presignExpiresSec
    };
  }

  getPublicUrl(key: string): string | null {
    if (this.config.publicUrl) {
      return `${trimSlash(this.config.publicUrl)}/${key}`;
    }
    if (!this.config.endpoint) {
      return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
    }
    const endpoint = trimSlash(this.config.endpoint);
    if (this.config.forcePathStyle) {
      return `${endpoint}/${this.config.bucket}/${key}`;
    }
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${this.config.bucket}.${url.host}/${key}`;
    } catch {
      return `${endpoint}/${this.config.bucket}/${key}`;
    }
  }
}

function readConfig(): S3Config {
  const bucket = requireEnv("S3_BUCKET");
  const region = requireEnv("S3_REGION");
  const accessKeyId = requireEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("S3_SECRET_ACCESS_KEY");
  const endpoint = process.env.S3_ENDPOINT;
  const forcePathStyle = isTrue(process.env.S3_FORCE_PATH_STYLE);
  const publicUrl = process.env.S3_PUBLIC_URL;
  const presignExpiresSec = toNumber(process.env.S3_PRESIGN_EXPIRES_SEC, 900);

  return {
    bucket,
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    publicUrl,
    presignExpiresSec
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for S3 storage`);
  }
  return value;
}

function isTrue(value: string | undefined): boolean {
  return String(value ?? "").toLowerCase() === "true";
}

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
