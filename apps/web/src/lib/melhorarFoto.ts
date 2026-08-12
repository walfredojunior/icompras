import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

// "Melhorar a foto": recortar a sobra e deixar o fundo branco.
//
// Pedido dele em 11/08/2026, com a regra certa junto: **"não altera a foto do
// produto, só melhora e deixa fundo branco"**. É o oposto de gerar imagem — o
// produto continua sendo o que foi fotografado. Muda enquadramento e fundo.
//
// ⚠⚠ NÃO LER ARQUIVO DO DISCO AQUI. NUNCA. ⚠⚠
//
// A primeira versão fazia `readFile(join(process.cwd(), "public", <variável>))`
// e **isso derrubou o site em 11/08/2026**. O Next analisa as leituras de
// arquivo para saber o que empacotar; com o caminho montado a partir de uma
// variável ele não consegue resolver e assume o pior: inclui a pasta inteira.
// A `public` deste projeto tem **14 GB e 1.417.259 arquivos** (as fotos dos
// produtos). Medido no servidor, no mesmo dia:
//
//     sem a leitura de arquivo → 1,5 GB · 1m26s · build ok
//     com a leitura de arquivo →  12  GB · 6m52s · morto pelo sistema
//
// ⚠ `outputFileTracingExcludes: { "*": ["./public/**/*"] }` NÃO resolve —
// testado, continuou em 12 GB. A única saída é o código não ler do disco.
//
// Por isso tudo entra por HTTP, inclusive as nossas próprias fotos: o site já
// as serve, e uma requisição local custa milissegundos. O compilador não vê
// leitura de arquivo nenhuma, e o problema deixa de existir.
const BASE_LOCAL = process.env.FOTO_BASE_URL ?? "http://127.0.0.1:3000";

/** O quadrado final. Todas as fotos iguais deixam a grade alinhada. */
const LADO = 1000;
/** Respiro em volta do produto, para ele não encostar na borda. */
const MARGEM = 40;

async function carregar(foto: string): Promise<Buffer | null> {
  // Caminho nosso (/media/...) vira endereço local; o resto tem de ser https.
  const url = foto.startsWith("/") ? `${BASE_LOCAL}${foto}` : foto;
  if (!/^https?:\/\//i.test(url)) return null;
  // Só o nosso próprio servidor pode ser chamado por http; de fora, só https.
  if (url.startsWith("http://") && !url.startsWith(BASE_LOCAL)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

export async function melhorarFoto(
  foto: string,
): Promise<{ ok: boolean; url?: string; erro?: string; mudou?: boolean }> {
  const buf = await carregar(foto);
  if (!buf) return { ok: false, erro: "não consegui abrir a foto atual" };

  try {
    const antes = await sharp(buf).metadata();

    // 1) Achata sobre BRANCO. Resolve o PNG transparente, que no site aparece
    //    com o fundo do cartão vazando por dentro do produto.
    const achatada = await sharp(buf).flatten({ background: "#ffffff" }).png().toBuffer();

    // 2) Corta a moldura de cor uniforme — a margem enorme das fotos de
    //    catálogo antigo. Tolerância folgada: fundo de estúdio quase nunca é
    //    branco puro, é 250-252.
    let cortada: Buffer;
    try {
      cortada = await sharp(achatada).trim({ threshold: 12 }).toBuffer();
    } catch {
      cortada = achatada; // foto de cor uniforme faz o corte falhar
    }

    const dep = await sharp(cortada).metadata();
    const l = dep.width ?? 0;
    const a = dep.height ?? 0;
    if (!l || !a) return { ok: false, erro: "a foto ficou vazia depois do corte" };

    // 3) Centraliza num quadrado branco, com respiro. `contain` mantém a
    //    proporção — o produto NÃO é esticado, que seria alterar justamente o
    //    que ele pediu para não alterar.
    const saida = await sharp(cortada)
      .resize({
        width: LADO - MARGEM * 2,
        height: LADO - MARGEM * 2,
        fit: "contain",
        background: "#ffffff",
        withoutEnlargement: true,
      })
      .extend({ top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM, background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .webp({ quality: 88 })
      .toBuffer();

    const nome = `${createHash("sha1").update(saida).digest("hex").slice(0, 16)}.webp`;
    const pasta = join(process.cwd(), "public", "media", "produtos");
    await mkdir(pasta, { recursive: true });
    await writeFile(join(pasta, nome), saida);

    const cortou = (antes.width ?? 0) > 0 ? 1 - (l * a) / ((antes.width ?? 1) * (antes.height ?? 1)) : 0;
    return { ok: true, url: `/media/produtos/${nome}`, mudou: cortou > 0.02 };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
