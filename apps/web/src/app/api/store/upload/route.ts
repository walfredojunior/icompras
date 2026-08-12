import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getCurrentStore } from "@/lib/storeauth";

// Upload da foto do produto, pela própria loja.
//
// ⚠ POR QUE EXISTE (11/08/2026). O editor só aceitava o ENDEREÇO da foto — e
// ele notou: "não vi pra fazer upload de foto". Falha minha de desenho: o
// cliente que este módulo atende é justamente o que tem sistema antigo e sem
// foto. Ele tem o arquivo no computador, não um link na internet.
//
// É parecido com o upload do admin, mas NÃO é o mesmo: aqui quem envia é
// gente de fora, e por isso vem com limites que lá não fazem falta.

/** Teto de tamanho. Foto de produto não precisa de mais que isto. */
const MAXIMO_MB = 8;

/**
 * Redimensiona para no máximo esta largura. Foto de catálogo não é pôster, e
 * imagem enorme na página é o que faz o site parecer lento no celular.
 */
const LARGURA = 1200;

export async function POST(req: Request) {
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "nenhum arquivo enviado" }, { status: 400 });
  }
  if (file.size > MAXIMO_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `arquivo grande demais (máximo ${MAXIMO_MB} MB)` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // ⚠ QUEM DECIDE SE É IMAGEM É O `sharp`, NÃO O NOME NEM O TIPO DECLARADO.
  //
  // Extensão e `content-type` vêm do outro lado e podem dizer qualquer coisa:
  // é o caminho clássico de subir um arquivo executável chamado "foto.jpg".
  // O `sharp` tenta DECODIFICAR de verdade — o que não é imagem falha aqui, e
  // a saída é sempre um WebP gerado por nós, nunca o arquivo original.
  //
  // É o mesmo princípio que usamos ao aceitar foto por URL na ingestão da API
  // (ver packages/core/media/seguranca.ts): o produto entra, a foto suspeita
  // não.
  let saida: Buffer;
  try {
    saida = await sharp(buf)
      .rotate() // respeita a orientação da câmera; sem isto foto de celular vira de lado
      .resize({ width: LARGURA, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "não consegui ler este arquivo como imagem — envie JPG, PNG ou WebP" },
      { status: 400 },
    );
  }

  // O nome sai do conteúdo, não do arquivo enviado: some com acento, espaço,
  // "../" e qualquer tentativa de escrever fora da pasta. E arquivo repetido
  // reaproveita o mesmo nome em vez de encher o disco.
  const nome = `${createHash("sha1").update(saida).digest("hex").slice(0, 16)}.webp`;
  const pasta = join(process.cwd(), "public", "media", "produtos");
  await mkdir(pasta, { recursive: true });
  await writeFile(join(pasta, nome), saida);

  return NextResponse.json({ url: `/media/produtos/${nome}` });
}
