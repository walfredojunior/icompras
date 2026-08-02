import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

const URL_CAMBIO = "https://www.cambioschaco.com.py/";

function parseNum(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}
function extract(html: string, code: string): { buy: number; sell: number } | null {
  const re = new RegExp(
    `id="exchange-${code.toLowerCase()}"[\\s\\S]*?purchase">([\\d.,]+)<[\\s\\S]*?sale">([\\d.,]+)<`,
    "i",
  );
  const m = html.match(re);
  if (!m) return null;
  const buy = parseNum(m[1]);
  const sell = parseNum(m[2]);
  return isFinite(sell) && sell > 0 ? { buy, sell } : null;
}

export async function POST() {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const res = await fetch(URL_CAMBIO, { headers: { "User-Agent": "iCompras-RatesBot/0.1" } });
  if (!res.ok) {
    return NextResponse.json({ error: "Falha ao buscar cambioschaco." }, { status: 502 });
  }
  const html = await res.text();
  let updated = 0;
  for (const code of ["USD", "BRL", "EUR"]) {
    const r = extract(html, code);
    if (!r) continue;
    await pool.query(
      `INSERT INTO exchange_rate (currency, pyg_value, buy, sell, source) VALUES (?, ?, ?, ?, 'cambioschaco')
       ON DUPLICATE KEY UPDATE pyg_value = VALUES(pyg_value), buy = VALUES(buy), sell = VALUES(sell), source = 'cambioschaco'`,
      [code, r.sell, r.buy, r.sell],
    );
    updated++;
  }
  return NextResponse.json({ ok: true, updated });
}
