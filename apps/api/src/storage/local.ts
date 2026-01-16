import type { PresignedUpload, PresignOptions, StorageClient } from "./types";

export function createLocalStorage(): StorageClient {
  return {
    async getPresignedUpload(_options: PresignOptions): Promise<PresignedUpload> {
      throw new Error(
        "Storage is not configured. Set IKA_STORAGE=s3 and S3_* environment variables."
      );
    },
    getPublicUrl() {
      return null;
    }
  };
}
