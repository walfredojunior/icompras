import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ productId: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const { productId } = await params;
  await pool.query("DELETE FROM featured_product WHERE product_id = ?", [Number(productId)]);
  return NextResponse.json({ ok: true });
}
