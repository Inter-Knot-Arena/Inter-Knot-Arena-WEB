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
  storeObject?(key: string, payload: { body: Buffer; contentType?: string }): Promise<void>;
  readObject?(key: string): Promise<{ body: Buffer; contentType?: string } | null>;
}
