import sharp from "sharp";

export interface OptimizedImage {
  width: number;
  format: "webp" | "avif";
  data: Buffer;
}

const WIDTHS = [200, 400, 800];

/**
 * Teto de pontos da imagem ABERTA — a defesa contra a "foto que explode".
 *
 * Existe arquivo de 40 KB que declara ter 50.000 × 50.000 pontos. Quem abre
 * precisa alocar largura × altura × 4 bytes ANTES de descobrir que é uma
 * armadilha: 10 GB para um arquivo minúsculo.
 *
 * O padrão do sharp é 268 megapixels — cerca de **1 GB de memória por foto**,
 * alto demais para esta máquina (4 núcleos, 15 GB, com banco e busca no mesmo
 * lugar; em 06/08/2026 o servidor já tinha sido reiniciado por falta de
 * memória). 50 megapixels cobre com folga qualquer foto de produto real: uma
 * câmera de 50 MP tira 8.660 × 5.774.
 *
 * O sharp lança quando passa do teto, e `ingerirImagem` transforma isso em
 * "produto entra sem foto".
 */
const MAX_PONTOS = 50_000_000;

/** Gera versões otimizadas (WebP + AVIF) em vários tamanhos a partir de um buffer. */
export async function optimizeImage(input: Buffer): Promise<OptimizedImage[]> {
  const out: OptimizedImage[] = [];
  for (const width of WIDTHS) {
    const base = sharp(input, { limitInputPixels: MAX_PONTOS }).resize({ width, withoutEnlargement: true });
    out.push({ width, format: "webp", data: await base.clone().webp({ quality: 78 }).toBuffer() });
    out.push({ width, format: "avif", data: await base.clone().avif({ quality: 55 }).toBuffer() });
  }
  return out;
}
