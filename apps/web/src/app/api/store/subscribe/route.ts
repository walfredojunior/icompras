import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentStore } from "@/lib/storeauth";

export async function POST(req: Request) {
  const store = await getCurrentStore();
  if (!store) {
    return NextResponse.json({ error: "Faça login na loja." }, { status: 401 });
  }
  const { planId } = await req.json().catch(() => ({}));
  if (!planId) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const plan = await pool.query("SELECT id FROM plan WHERE id = ? AND active = 1 LIMIT 1", [planId]);
  if (!plan.length) {
    return NextResponse.json({ error: "Plano não encontrado." }, { status: 400 });
  }

  const provider = process.env.PAYMENT_PROVIDER ?? "manual";
  if (provider !== "manual") {
    // Gateways reais (Bancard/Pagopar) exigem credenciais e um fluxo de checkout/webhook.
    return NextResponse.json(
      { error: `Gateway "${provider}" ainda não configurado neste ambiente (dev usa "manual").` },
      { status: 501 },
    );
  }

  // Modo manual: encerra assinatura ativa anterior e ativa a nova direto.
  await pool.query(
    "UPDATE subscription SET status = 'canceled' WHERE store_id = ? AND status IN ('active','trialing')",
    [store.id],
  );
  await pool.query(
    `INSERT INTO subscription (store_id, plan_id, status, gateway, current_period_start, current_period_end)
     VALUES (?, ?, 'active', NULL, NOW(), NOW() + INTERVAL 30 DAY)`,
    [store.id, planId],
  );
  return NextResponse.json({ ok: true });
}
