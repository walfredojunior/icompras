import { createHash } from "node:crypto";
import { getStorageProvider } from "../storage/index.js";
import { optimizeImage } from "./image.js";
import { buscarImagemComSeguranca, ImagemRecusada } from "./seguranca.js";

export * from "./image.js";
export * from "./seguranca.js";

/** O que aconteceu com a imagem — para o log e para o painel do admin. */
export interface ResultadoImagem {
  url: string | null;
  /** Preenchido quando a imagem foi recusada. Null quando deu certo. */
  recusa: string | null;
}

/**
 * Baixa uma imagem por URL, gera versões otimizadas e as armazena.
 * Retorna a URL da versão preferida (400px WebP) ou null se falhar (resiliente).
 *
 * ⚠ TODA imagem enviada por loja passa por `buscarImagemComSeguranca` — ver o
 * porquê e as sete travas em `seguranca.ts`. A versão anterior fazia
 * `fetch(url)` direto, o que deixava a loja escolher qualquer endereço que o
 * servidor alcança (inclusive o Redis e o banco em 127.0.0.1) e baixar
 * qualquer tamanho para dentro da memória.
 */
export async function ingestImageFromUrl(url: string): Promise<string | null> {
  return (await ingerirImagem(url)).url;
}

/** Igual, mas dizendo POR QUE recusou — é o que o painel do admin mostra à loja. */
export async function ingerirImagem(url: string): Promise<ResultadoImagem> {
  let buf: Buffer;
  try {
    buf = await buscarImagemComSeguranca(url);
  } catch (e) {
    // Decisão do dono (06/08/2026): foto recusada não derruba o produto — o
    // anúncio entra sem imagem. Por isso devolvemos o motivo em vez de lançar.
    if (e instanceof ImagemRecusada) return { url: null, recusa: e.motivo };
    return { url: null, recusa: "nao-respondeu" };
  }

  try {
    const variants = await optimizeImage(buf);
    const storage = getStorageProvider();
    const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);

    let preferred: string | null = null;
    for (const v of variants) {
      const path = `${hash}/${v.width}.${v.format}`;
      const saved = await storage.save(path, v.data, `image/${v.format}`);
      if (v.width === 400 && v.format === "webp") preferred = saved.url;
    }
    return { url: preferred, recusa: preferred ? null : "nao-e-imagem-de-verdade" };
  } catch {
    // Chegou até aqui parecendo imagem mas o processador não conseguiu abrir:
    // arquivo corrompido ou formato exótico. Mesmo tratamento.
    return { url: null, recusa: "nao-e-imagem-de-verdade" };
  }
}
