import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

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
  ];

  let blockId = Number(b.id ?? 0);
  if (blockId > 0) {
    await pool.query(
      `UPDATE category_block SET title_pt = ?, title_es = ?, title_en = ?,
              subtitle_pt = ?, subtitle_es = ?, subtitle_en = ?, icon = ?, position = ?, active = ?
        WHERE id = ?`,
      [...campos, blockId],
    );
    await pool.query("DELETE FROM category_block_item WHERE block_id = ?", [blockId]);
  } else {
    const res = await pool.query(
      `INSERT INTO category_block (title_pt, title_es, title_en, subtitle_pt, subtitle_es, subtitle_en, icon, position, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  return NextResponse.json({ ok: true, id: blockId });
}
