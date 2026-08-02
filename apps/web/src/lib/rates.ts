import { pool } from "./db";

export type Rates = Record<string, number>; // guaraníes por 1 unidade da moeda

let cache: { rates: Rates; at: number } | null = null;
const TTL = 5 * 60 * 1000;

export async function getRates(): Promise<Rates> {
  if (cache && Date.now() - cache.at < TTL) return cache.rates;
  const rows = await pool.query("SELECT currency, pyg_value FROM exchange_rate");
  const rates: Rates = {};
  for (const r of rows) rates[r.currency] = Number(r.pyg_value);
  cache = { rates, at: Date.now() };
  return rates;
}
