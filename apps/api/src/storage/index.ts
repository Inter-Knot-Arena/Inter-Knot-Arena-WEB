import type { StorageClient } from "./types.js";
import { createLocalStorage } from "./local.js";
import { createS3Storage } from "./s3.js";

export function createStorage(): StorageClient {
  const driver = process.env.IKA_STORAGE ?? (process.env.S3_BUCKET ? "s3" : "local");
  if (driver === "s3") {
    return createS3Storage();
  }
  if (driver === "local") {
    return createLocalStorage();
  }
  throw new Error(`Unknown storage driver: ${driver}`);
}
