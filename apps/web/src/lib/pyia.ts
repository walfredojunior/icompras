import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { pool } from "./db";
import { podeUsar, anotarUso } from "./iaConfig";

/* eslint-disable @typescript-eslint/no-explicit-any */

// PYIA — o que a inteligência artificial faz pelo produto do cliente.
//
// Três ajudas, na ordem em que devem ser tentadas (decidida em 11/08/2026):
//   1. foto do NOSSO catálogo  — grátis, foto real do produto certo
//   2. descrição por DeepSeek  — barata, e o cliente revisa antes
//   3. foto gerada por IA      — paga, e a imagem é INVENTADA
//
// ⚠ Toda função aqui passa por `podeUsar()` antes e por `anotarUso()` depois,
// inclusive quando falha. A conta é do dono (decisão dele, 11/08): serviço
// pago acionado por tela de cliente sem teto e sem contador é prejuízo que só
// aparece na fatura.

/** Baixa uma imagem, confere que é imagem mesmo, e guarda como WebP nosso. */
async function guardarImagem(url: string): Promise<string | null> {
  // ⚠ Só https, e o `sharp` decide se é imagem — o mesmo cuidado do upload da
  // loja. O endereço vem de um serviço de fora; confiar no que ele diz que é
  // seria repetir o erro que a proteção de imagens já resolveu na ingestão.
  if (!/^https:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const saida = await sharp(buf)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const nome = `${createHash("sha1").update(saida).digest("hex").slice(0, 16)}.webp`;
    const pasta = join(process.cwd(), "public", "media", "produtos");
    await mkdir(pasta, { recursive: true });
    await writeFile(join(pasta, nome), saida);
    return `/media/produtos/${nome}`;
  } catch {
    return null;
  }
}

/**
 * 1) A FOTO QUE JÁ TEMOS — a primeira coisa a tentar, e a melhor.
 *
 * 💡 Muitos produtos que o cliente manda sem foto já estão no iCompras,
 * vendidos por outra loja, COM foto real. Procurar aqui é de graça, é
 * instantâneo e a foto é do produto certo — enquanto a IA inventaria uma.
 *
 * Não gasta cota nenhuma: não passa por `podeUsar`.
 */
export async function fotoDoCatalogo(
  productId: number,
  nome: string,
): Promise<{ url: string; deQuem: string } | null> {
  const limpo = nome.replace(/^TESTE\s*[—-]\s*/i, "").trim();
  if (limpo.length < 6) return null;

  const linhas = await pool
    .query(
      `SELECT p.canonical_name AS nome, p.primary_image_url AS foto,
              MATCH(p.canonical_name) AGAINST (? IN NATURAL LANGUAGE MODE) AS pontos
         FROM product p
        WHERE p.id <> ? AND p.primary_image_url IS NOT NULL
          AND MATCH(p.canonical_name) AGAINST (? IN NATURAL LANGUAGE MODE)
        ORDER BY pontos DESC
        LIMIT 1`,
      [limpo, productId, limpo],
    )
    .catch(() => []);

  if (!linhas.length) return null;
  return { url: String(linhas[0].foto), deQuem: String(linhas[0].nome) };
}

/**
 * 2) DESCRIÇÃO — DeepSeek.
 *
 * ⚠ O PROMPT PROÍBE INVENTAR. O risco real não é a IA escrever feio, é ela
 * acrescentar característica que o produto não tem: o nome diz "iPhone 15
 * 128GB" e sai "câmera de 48MP e resistência à água" — que pode estar certo,
 * ou não, e vira informação errada na página, no nome da loja do cliente.
 *
 * A trava de verdade não é o prompt, é o fluxo: a PYIA propõe, o cliente lê,
 * corrige e libera. Nada é publicado sem alguém olhar.
 */
export async function gerarDescricao(
  nome: string,
  ficha: Array<{ k: string; v: string }>,
): Promise<{ ok: boolean; texto?: string; erro?: string }> {
  const p = await podeUsar("texto");
  if (!p.ok) return { ok: false, erro: p.motivo ?? "PYIA de texto indisponível" };

  const fichaTexto = ficha.length
    ? `\nFicha técnica conhecida:\n${ficha.map((f) => `- ${f.k}: ${f.v}`).join("\n")}`
    : "";

  try {
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.chave}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: p.model || "deepseek-chat",
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "Você escreve descrições curtas de produto para um comparador de preços do Paraguai, " +
              "em português do Brasil. REGRA ABSOLUTA: use APENAS o que estiver no nome e na ficha " +
              "fornecidos. É proibido acrescentar qualquer característica, medida, capacidade, " +
              "tecnologia ou compatibilidade que não esteja escrita ali — mesmo que você tenha " +
              "certeza. Se a informação for pouca, escreva pouco. Sem promessas de entrega, sem " +
              "preço, sem superlativos de propaganda. Dois a quatro períodos, texto corrido.",
          },
          { role: "user", content: `Produto: ${nome}${fichaTexto}` },
        ],
      }),
    });

    const j: any = await r.json().catch(() => ({}));
    const texto = j?.choices?.[0]?.message?.content?.trim();
    if (!r.ok || !texto) {
      const erro = j?.error?.message ?? `resposta inesperada (HTTP ${r.status})`;
      await anotarUso("texto", p.provider, false, erro);
      return { ok: false, erro };
    }
    await anotarUso("texto", p.provider, true);
    return { ok: true, texto };
  } catch (e) {
    const erro = (e as Error).message;
    await anotarUso("texto", p.provider, false, erro);
    return { ok: false, erro };
  }
}

/**
 * 3) FOTO GERADA — último recurso.
 *
 * ⚠ A IMAGEM É INVENTADA, e num comparador isso é diferente de um enfeite: o
 * comprador acha que está vendo o produto. Por isso ela é a ÚLTIMA opção da
 * tela (depois do catálogo e do upload) e o cliente é avisado do que está
 * fazendo antes de aceitar.
 */
export async function gerarFoto(nome: string): Promise<{ ok: boolean; url?: string; erro?: string }> {
  const p = await podeUsar("imagem");
  if (!p.ok) return { ok: false, erro: p.motivo ?? "PYIA de imagem indisponível" };

  const prompt =
    `Foto de catálogo de comércio eletrônico: ${nome}. ` +
    "Produto centralizado, fundo branco liso, iluminação de estúdio suave, sem texto, " +
    "sem marca d'água, sem pessoas, enquadramento frontal.";

  try {
    let urlImagem: string | null = null;

    if (p.provider === "fal") {
      const r = await fetch(`https://fal.run/${String(p.model).replace(/^\/+/, "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Key ${p.chave}` },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({ prompt, image_size: "square_hd", num_images: 1 }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        const erro = j?.detail ?? j?.error ?? `HTTP ${r.status}`;
        await anotarUso("imagem", p.provider, false, String(erro));
        return { ok: false, erro: String(erro) };
      }
      urlImagem = j?.images?.[0]?.url ?? null;
    } else {
      // OpenAI e Google entram quando ele cadastrar as chaves — hoje só a do
      // fal.ai está guardada. Prefiro recusar com clareza a fingir suporte.
      await anotarUso("imagem", p.provider, false, "provedor ainda não implementado");
      return { ok: false, erro: `o provedor "${p.provider}" ainda não está implementado aqui` };
    }

    if (!urlImagem) {
      await anotarUso("imagem", p.provider, false, "resposta sem imagem");
      return { ok: false, erro: "o serviço respondeu sem imagem" };
    }

    const guardada = await guardarImagem(urlImagem);
    if (!guardada) {
      await anotarUso("imagem", p.provider, false, "não consegui guardar a imagem");
      return { ok: false, erro: "não consegui guardar a imagem gerada" };
    }
    await anotarUso("imagem", p.provider, true);
    return { ok: true, url: guardada };
  } catch (e) {
    const erro = (e as Error).message;
    await anotarUso("imagem", p.provider, false, erro);
    return { ok: false, erro };
  }
}
