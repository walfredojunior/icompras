import { NextResponse } from "next/server";
import { getCurrentStore } from "@/lib/storeauth";
import { pool } from "@/lib/db";
import { fotoDoCatalogo, gerarDescricao, gerarFoto } from "@/lib/pyia";
import { melhorarFoto } from "@/lib/melhorarFoto";

/* eslint-disable @typescript-eslint/no-explicit-any */

// As ajudas da PYIA na tela da loja.
//
// ⚠ A oferta é sempre conferida contra a loja da SESSÃO. Sem isso, uma loja
// mandaria o id de uma oferta da concorrente e gastaria a cota do dono
// gerando conteúdo para o produto de outra pessoa.

async function doProduto(storeId: number, offerId: number) {
  const [r] = await pool
    .query(
      `SELECT p.id AS product_id, p.canonical_name AS nome, p.specs
         FROM offer o
         JOIN product_variant v ON v.id = o.variant_id
         JOIN product p ON p.id = v.product_id
        WHERE o.id = ? AND o.store_id = ? LIMIT 1`,
      [offerId, storeId],
    )
    .catch(() => [null]);
  return r ?? null;
}

export async function POST(req: Request) {
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { acao?: string; offerId?: number };
  const offerId = Number(b.offerId);
  if (!offerId) return NextResponse.json({ error: "produto não informado" }, { status: 400 });

  const prod = await doProduto(loja.id, offerId);
  if (!prod) return NextResponse.json({ error: "produto não encontrado nesta loja" }, { status: 404 });

  const nome = String(prod.nome ?? "");

  if (b.acao === "foto-catalogo") {
    const achado = await fotoDoCatalogo(Number(prod.product_id), nome);
    return achado
      ? NextResponse.json({ ok: true, url: achado.url, deQuem: achado.deQuem })
      : NextResponse.json({ error: "não encontrei esse produto no nosso catálogo" }, { status: 404 });
  }

  if (b.acao === "descricao") {
    let ficha: Array<{ k: string; v: string }> = [];
    try {
      const p = prod.specs ? (typeof prod.specs === "string" ? JSON.parse(prod.specs) : prod.specs) : [];
      if (Array.isArray(p)) ficha = p;
    } catch {
      /* ficha inválida não impede a descrição */
    }
    const r = await gerarDescricao(nome, ficha);
    return r.ok
      ? NextResponse.json({ ok: true, texto: r.texto })
      : NextResponse.json({ error: r.erro }, { status: 400 });
  }

  if (b.acao === "melhorar-foto") {
    // Não passa por `podeUsar`: isto NÃO usa IA nem gasta nada. É só o
    // processador de imagem recortando a moldura e achatando sobre branco.
    const [f] = await pool
      .query(
        `SELECT p.primary_image_url AS foto
           FROM offer o JOIN product_variant v ON v.id = o.variant_id
           JOIN product p ON p.id = v.product_id
          WHERE o.id = ? AND o.store_id = ? LIMIT 1`,
        [offerId, loja.id],
      )
      .catch(() => [null]);
    const atual = (b as any).foto || f?.foto;
    if (!atual) return NextResponse.json({ error: "este produto ainda não tem foto" }, { status: 400 });
    const r = await melhorarFoto(String(atual));
    return r.ok
      ? NextResponse.json({ ok: true, url: r.url, mudou: r.mudou })
      : NextResponse.json({ error: r.erro }, { status: 400 });
  }

  if (b.acao === "foto-ia") {
    const r = await gerarFoto(nome);
    return r.ok
      ? NextResponse.json({ ok: true, url: r.url })
      : NextResponse.json({ error: r.erro }, { status: 400 });
  }

  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}
