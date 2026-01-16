export interface PresignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl?: string;
  expiresIn: number;
}

export interface PresignOptions {
  key: string;
  contentType?: string;
}

export interface StorageClient {
  getPresignedUpload(options: PresignOptions): Promise<PresignedUpload>;
  getPublicUrl(key: string): string | null;
}
