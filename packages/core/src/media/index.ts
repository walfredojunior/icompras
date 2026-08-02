import { createHash } from "node:crypto";
import { getStorageProvider } from "../storage/index.js";
import { optimizeImage } from "./image.js";

export * from "./image.js";

/**
 * Baixa uma imagem por URL, gera versões otimizadas e as armazena.
 * Retorna a URL da versão preferida (400px WebP) ou null se falhar (resiliente).
 */
export async function ingestImageFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const variants = await optimizeImage(buf);
    const storage = getStorageProvider();
    const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);

    let preferred: string | null = null;
    for (const v of variants) {
      const path = `${hash}/${v.width}.${v.format}`;
      const saved = await storage.save(path, v.data, `image/${v.format}`);
      if (v.width === 400 && v.format === "webp") preferred = saved.url;
    }
    return preferred;
  } catch {
    return null; // rede/formato inválido não pode derrubar a ingestão
  }
}
