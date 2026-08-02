import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para criar alertas." }, { status: 401 });
  }
  const { productId, variantId, targetPrice, channel } = await req.json().catch(() => ({}));
  if (!productId || !targetPrice || Number(targetPrice) <= 0) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  await pool.query(
    `INSERT INTO price_alert (user_id, product_id, variant_id, target_price, currency, channel)
     VALUES (?, ?, ?, ?, 'PYG', ?)`,
    [user.id, productId, variantId ?? null, Number(targetPrice), channel === "whatsapp" ? "whatsapp" : "email"],
  );
  return NextResponse.json({ ok: true });
}
