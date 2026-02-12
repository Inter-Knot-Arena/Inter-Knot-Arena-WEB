import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PresignedUpload, PresignOptions, StorageClient } from "./types.js";

interface LocalStorageConfig {
  rootDir: string;
  origin: string;
  publicBase: string;
}

const metaMap = new Map<string, { contentType?: string }>();

export function createLocalStorage(): StorageClient {
  const config = readConfig();

  return {
    async getPresignedUpload(options: PresignOptions): Promise<PresignedUpload> {
      const encodedKey = encodeURIComponent(options.key);
      const uploadUrl = `${config.origin}/uploads/local/${encodedKey}`;
      const publicUrl = `${config.publicBase}/uploads/local/${encodedKey}`;
      return {
        key: options.key,
        uploadUrl,
        publicUrl,
        expiresIn: 900
      };
    },
    getPublicUrl(key) {
      return `${config.publicBase}/uploads/local/${encodeURIComponent(key)}`;
    },
    async storeObject(key, payload) {
      const absolutePath = buildAbsolutePath(config.rootDir, key);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, payload.body);
      metaMap.set(key, { contentType: payload.contentType });
    },
    async readObject(key) {
      const absolutePath = buildAbsolutePath(config.rootDir, key);
      try {
        await stat(absolutePath);
      } catch {
        return null;
      }
      const body = await readFile(absolutePath);
      return {
        body,
        contentType: metaMap.get(key)?.contentType
      };
    }
  };
}

function readConfig(): LocalStorageConfig {
  const rootDir = path.resolve(process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), ".ika-storage"));
  const origin = (process.env.API_ORIGIN ?? "http://localhost:4000").replace(/\/+$/, "");
  const publicBase = (process.env.LOCAL_STORAGE_PUBLIC_BASE ?? origin).replace(/\/+$/, "");
  return { rootDir, origin, publicBase };
}

function buildAbsolutePath(rootDir: string, key: string): string {
  const sanitized = key
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .filter(Boolean)
    .join(path.sep);
  return path.join(rootDir, sanitized);
}
