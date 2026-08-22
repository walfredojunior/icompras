import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";
import { lancarNaConta } from "@/lib/pedidos";

// Cria ou atualiza um bloco de destaque da home (e as categorias que ele reúne).
export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const titlePt = String(b.title_pt ?? "").trim();
  if (!titlePt) {
    return NextResponse.json({ error: "O título em português é obrigatório." }, { status: 400 });
  }
  const categorias: number[] = Array.isArray(b.categories)
    ? b.categories.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
    : [];
  if (!categorias.length) {
    return NextResponse.json({ error: "Escolha pelo menos uma categoria." }, { status: 400 });
  }

  const campos = [
    titlePt,
    b.title_es?.trim() || null,
    b.title_en?.trim() || null,
    b.subtitle_pt?.trim() || null,
    b.subtitle_es?.trim() || null,
    b.subtitle_en?.trim() || null,
    b.icon || null,
    Number(b.position ?? 0),
    b.active === false ? 0 : 1,
    // Venda (22/08/2026): quem paga, se é publicidade e por quanto tempo.
    b.store_id ? Number(b.store_id) : null,
    b.is_paid ? 1 : 0,
    b.starts_at || null,
    b.ends_at || null,
  ];

  if (b.starts_at && b.ends_at && b.starts_at > b.ends_at) {
    return NextResponse.json({ error: "A data de término é anterior à de início." }, { status: 400 });
  }

  let blockId = Number(b.id ?? 0);
  if (blockId > 0) {
    await pool.query(
      `UPDATE category_block SET title_pt = ?, title_es = ?, title_en = ?,
              subtitle_pt = ?, subtitle_es = ?, subtitle_en = ?, icon = ?, position = ?, active = ?,
              store_id = ?, is_paid = ?, starts_at = ?, ends_at = ?
        WHERE id = ?`,
      [...campos, blockId],
    );
    await pool.query("DELETE FROM category_block_item WHERE block_id = ?", [blockId]);
  } else {
    const res = await pool.query(
      `INSERT INTO category_block (title_pt, title_es, title_en, subtitle_pt, subtitle_es, subtitle_en,
                                   icon, position, active, store_id, is_paid, starts_at, ends_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      campos,
    );
    blockId = Number(res.insertId);
  }

  for (let i = 0; i < categorias.length; i++) {
    await pool.query(
      "INSERT INTO category_block_item (block_id, category_id, position) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE position = VALUES(position)",
      [blockId, categorias[i], i],
    );
  }

  // A conta a receber nasce junto, como nos banners e destaques.
  const valor = Number(b.valor ?? 0);
  let lancado: { pedido: string; valor: number } | null = null;
  if (b.store_id && b.is_paid && Number.isFinite(valor) && valor > 0) {
    try {
      lancado = await lancarNaConta({
        blocoId: blockId,
        storeId: Number(b.store_id),
        titulo: b.title_pt?.trim() || null,
        categorySlug: null,
        slot: null,
        inicio: b.starts_at || null,
        fim: b.ends_at || null,
        valor,
        duracao: b.duracao || "mensal",
      });
    } catch {
      lancado = null;
    }
  }

  return NextResponse.json({ ok: true, id: blockId, lancado });
}
