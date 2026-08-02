import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  if (!b.image_url) {
    return NextResponse.json({ error: "Imagem obrigatória." }, { status: 400 });
  }
  await pool.query(
    `INSERT INTO banner (title, image_url, link_url, placement, category_slug, store_id, is_paid, position, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.title ?? null,
      b.image_url,
      b.link_url ?? null,
      b.placement ?? "home_hero",
      b.placement === "category" ? b.category_slug ?? null : null,
      b.store_id ?? null,
      b.is_paid ? 1 : 0,
      Number(b.position ?? 0),
      b.active === false ? 0 : 1,
    ],
  );
  return NextResponse.json({ ok: true });
}
