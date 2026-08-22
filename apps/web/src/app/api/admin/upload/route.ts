import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { getCurrentAdmin } from "@/lib/adminauth";

// Envio da arte de um banner.
//
// ⚠ AJUSTA A ARTE AO FORMATO DO ESPAÇO (21/08/2026). Ele pediu: "na hora de
// cadastrar já avisar o formato ou converter". Converter é melhor que avisar —
// o anunciante manda a arte no tamanho que tem, e sem ajuste ela aparecia
// esticada ou cortada de qualquer jeito pelo `object-cover` do navegador.
//
// 💡 Os dois formatos do site:
//    858 × 375 (≈2,3:1) — banner padrão: topo da home, topo de categoria
//    818 × 137 (≈6:1)   — faixa fina: meio e fim da lista de resultados
//
// O recorte é PELO CENTRO (`position: "attention"` seria esperto demais e
// imprevisível: cortaria em volta do que o sharp julga "interessante", e quem
// desenhou a arte já pôs o importante no meio).

/** Os formatos que o site usa, por espaço. */
const FORMATOS: Record<string, { w: number; h: number }> = {
  padrao: { w: 858, h: 375 },
  faixa: { w: 818, h: 137 },
};

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());

  // Qual formato usar. Sem pedido, mantém o comportamento antigo (só reduz a
  // largura) — assim nada que já chamava esta rota muda de comportamento.
  const formato = String(form.get("formato") ?? "");
  const alvo = FORMATOS[formato];

  const entrada = sharp(buf);
  const meta = await entrada.metadata();
  const larguraOriginal = meta.width ?? 0;
  const alturaOriginal = meta.height ?? 0;

  let out: Buffer;
  let ajustada = false;
  if (alvo) {
    // ⚠ A conta em 3 casas evita "ajustar" uma arte que já está certa: uma
    // imagem de 1636×274 tem exatamente a proporção de 818×137, e recortá-la
    // seria perder qualidade à toa.
    const propAlvo = alvo.w / alvo.h;
    const propArte = alturaOriginal > 0 ? larguraOriginal / alturaOriginal : propAlvo;
    ajustada = Math.abs(propAlvo - propArte) > 0.01;

    // Sobe a resolução para telas grandes sem esticar arte pequena: usa o dobro
    // do alvo, mas nunca mais que a arte original tem.
    const largura = Math.min(alvo.w * 2, Math.max(larguraOriginal, alvo.w));
    const altura = Math.round(largura / propAlvo);
    out = await entrada
      .resize(largura, altura, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } else {
    out = await entrada.resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  }

  const name = `${createHash("sha1").update(out).digest("hex").slice(0, 16)}.webp`;
  const dir = join(process.cwd(), "public", "media", "banners");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), out);

  // A tela usa isto para dizer o que aconteceu com a arte — em vez de a pessoa
  // descobrir olhando o banner cortado depois de publicado.
  return NextResponse.json({
    url: `/media/banners/${name}`,
    ajustada,
    original: larguraOriginal && alturaOriginal ? `${larguraOriginal} × ${alturaOriginal}` : null,
    formato: alvo ? `${alvo.w} × ${alvo.h}` : null,
  });
}
