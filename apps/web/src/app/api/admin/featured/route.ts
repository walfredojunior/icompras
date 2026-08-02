import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const { productId, position } = await req.json().catch(() => ({}));
  if (!productId) {
    return NextResponse.json({ error: "Produto inválido." }, { status: 400 });
  }
  await pool.query(
    "INSERT INTO featured_product (product_id, position) VALUES (?, ?) ON DUPLICATE KEY UPDATE position = VALUES(position)",
    [Number(productId), Number(position ?? 0)],
  );
  return NextResponse.json({ ok: true });
}
