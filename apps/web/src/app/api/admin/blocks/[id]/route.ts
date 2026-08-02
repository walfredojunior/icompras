import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const { id } = await params;
  // As categorias do bloco saem junto (ON DELETE CASCADE).
  await pool.query("DELETE FROM category_block WHERE id = ?", [Number(id)]);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const { id } = await params;
  const { active } = await req.json().catch(() => ({}));
  await pool.query("UPDATE category_block SET active = ? WHERE id = ?", [active ? 1 : 0, Number(id)]);
  return NextResponse.json({ ok: true });
}
