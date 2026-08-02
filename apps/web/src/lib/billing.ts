import { pool } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Plan {
  id: number;
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  maxProducts: number; // 0 = ilimitado
  maxApiPerDay: number; // 0 = ilimitado
  active: boolean;
  public: boolean;
}

function mapPlan(r: any): Plan {
  return {
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    priceMonthly: Number(r.price_monthly),
    priceYearly: Number(r.price_yearly),
    currency: r.currency,
    trialDays: Number(r.trial_days),
    maxProducts: Number(r.max_products),
    maxApiPerDay: Number(r.max_api_requests_per_day),
    active: Number(r.active) === 1,
    public: Number(r.public) === 1,
  };
}

export async function getAllPlans(): Promise<Plan[]> {
  const rows = await pool.query(
    `SELECT id, slug, name, price_monthly, price_yearly, currency, trial_days,
            max_products, max_api_requests_per_day, active, public
     FROM plan ORDER BY active DESC, price_monthly ASC, id`,
  );
  return rows.map(mapPlan);
}

// Quantos clientes (assinaturas) usam este plano — usado antes de apagar.
export async function planSubscriberCount(planId: number): Promise<number> {
  const r = await pool.query("SELECT COUNT(*) AS c FROM subscription WHERE plan_id = ?", [planId]);
  return Number(r[0]?.c ?? 0);
}

export async function deletePlan(planId: number): Promise<void> {
  await pool.query("DELETE FROM plan WHERE id = ?", [planId]);
}

// Preço anual sugerido: 12 meses com 10% de desconto.
export function yearlyFromMonthly(monthly: number): number {
  return Math.round(monthly * 12 * 0.9 * 100) / 100;
}

function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "plano"
  );
}

export async function upsertPlan(input: {
  id?: number;
  slug?: string;
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  trialDays: number;
  maxProducts: number;
  maxApiPerDay: number;
  active: boolean;
  public: boolean;
}): Promise<void> {
  const yearly = input.priceYearly && input.priceYearly > 0 ? input.priceYearly : yearlyFromMonthly(input.priceMonthly);
  if (input.id) {
    await pool.query(
      `UPDATE plan SET name=?, price_monthly=?, price_yearly=?, trial_days=?,
         max_products=?, max_api_requests_per_day=?, active=?, public=? WHERE id=?`,
      [input.name, input.priceMonthly, yearly, input.trialDays, input.maxProducts, input.maxApiPerDay, input.active ? 1 : 0, input.public ? 1 : 0, input.id],
    );
  } else {
    const slug = input.slug || slugify(input.name);
    await pool.query(
      `INSERT INTO plan (slug, name, price_monthly, price_yearly, currency, trial_days, max_products, max_api_requests_per_day, active, public)
       VALUES (?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), price_monthly=VALUES(price_monthly), price_yearly=VALUES(price_yearly),
         trial_days=VALUES(trial_days), max_products=VALUES(max_products), max_api_requests_per_day=VALUES(max_api_requests_per_day),
         active=VALUES(active), public=VALUES(public)`,
      [slug, input.name, input.priceMonthly, yearly, input.trialDays, input.maxProducts, input.maxApiPerDay, input.active ? 1 : 0, input.public ? 1 : 0],
    );
  }
}
