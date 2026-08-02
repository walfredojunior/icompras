import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface StoredFile {
  url: string;
}

export interface StorageProvider {
  save(relativePath: string, data: Buffer, contentType: string): Promise<StoredFile>;
}

function defaultMediaDir(): string {
  // packages/core/src/storage -> raiz do repo -> apps/web/public/media
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..", "..", "apps", "web", "public", "media");
}

/** Armazenamento local (dev): grava em apps/web/public/media e serve em /media. */
class LocalStorageProvider implements StorageProvider {
  constructor(private baseDir: string, private publicBase: string) {}

  async save(relativePath: string, data: Buffer): Promise<StoredFile> {
    const full = join(this.baseDir, relativePath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
    const url = `${this.publicBase}/${relativePath}`.replace(/\\/g, "/");
    return { url };
  }
}

export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "local") {
    const dir = process.env.STORAGE_LOCAL_DIR ?? defaultMediaDir();
    const base = process.env.STORAGE_PUBLIC_BASE ?? "/media";
    return new LocalStorageProvider(dir, base);
  }
  // s3 / r2 entram depois (mesma interface).
  throw new Error(`STORAGE_PROVIDER não suportado ainda: "${provider}".`);
}
