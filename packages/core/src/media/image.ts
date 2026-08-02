import sharp from "sharp";

export interface OptimizedImage {
  width: number;
  format: "webp" | "avif";
  data: Buffer;
}

const WIDTHS = [200, 400, 800];

/** Gera versões otimizadas (WebP + AVIF) em vários tamanhos a partir de um buffer. */
export async function optimizeImage(input: Buffer): Promise<OptimizedImage[]> {
  const out: OptimizedImage[] = [];
  for (const width of WIDTHS) {
    const base = sharp(input).resize({ width, withoutEnlargement: true });
    out.push({ width, format: "webp", data: await base.clone().webp({ quality: 78 }).toBuffer() });
    out.push({ width, format: "avif", data: await base.clone().avif({ quality: 55 }).toBuffer() });
  }
  return out;
}
