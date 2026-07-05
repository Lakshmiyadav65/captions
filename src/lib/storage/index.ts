import { config } from "../config";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { Storage } from "./types";

export * from "./types";

// One shared storage instance chosen by STORAGE_DRIVER (reused across hot reloads).
const globalForStorage = globalThis as unknown as { storage?: Storage };

export function getStorage(): Storage {
  if (!globalForStorage.storage) {
    globalForStorage.storage = config.usesS3 ? new S3Storage() : new LocalStorage();
  }
  return globalForStorage.storage;
}
