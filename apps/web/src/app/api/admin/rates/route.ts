import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const { currency, pyg_value } = await req.json().catch(() => ({}));
  if (!currency || !(Number(pyg_value) > 0)) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }
  await pool.query(
    `INSERT INTO exchange_rate (currency, pyg_value, sell, source) VALUES (?, ?, ?, 'manual')
     ON DUPLICATE KEY UPDATE pyg_value = VALUES(pyg_value), sell = VALUES(sell), source = 'manual'`,
    [currency, Number(pyg_value), Number(pyg_value)],
  );
  return NextResponse.json({ ok: true });
}
