import "../env.js";
import { pool } from "@icompras/db";

const URL = "https://www.cambioschaco.com.py/";
const CURRENCIES = ["USD", "BRL", "EUR"]; // PYG é a base (=1)

function parseNum(s: string): number {
  // "6.030" -> 6030 ; "3,85" -> 3.85
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
  if (!isFinite(buy) || !isFinite(sell) || sell <= 0) return null;
  return { buy, sell };
}

async function main(): Promise<void> {
  const res = await fetch(URL, { headers: { "User-Agent": "iCompras-RatesBot/0.1" } });
  if (!res.ok) {
    console.error("Falha ao buscar cambioschaco:", res.status);
    process.exit(1);
  }
  const html = await res.text();

  await pool.query(
    "INSERT INTO exchange_rate (currency, pyg_value, buy, sell, source) VALUES ('PYG',1,1,1,'base') ON DUPLICATE KEY UPDATE pyg_value=1",
  );

  let ok = 0;
  for (const code of CURRENCIES) {
    const r = extract(html, code);
    if (!r) {
      console.log(`  ${code}: não encontrado no HTML`);
      continue;
    }
    await pool.query(
      `INSERT INTO exchange_rate (currency, pyg_value, buy, sell, source)
       VALUES (?, ?, ?, ?, 'cambioschaco')
       ON DUPLICATE KEY UPDATE pyg_value=VALUES(pyg_value), buy=VALUES(buy), sell=VALUES(sell), source='cambioschaco'`,
      [code, r.sell, r.buy, r.sell],
    );
    console.log(`  ${code}: compra ${r.buy} · venta ${r.sell} Gs`);
    ok++;
  }

  console.log(`Câmbio atualizado (${ok} moeda(s), fonte cambioschaco).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
