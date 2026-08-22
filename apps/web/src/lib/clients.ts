import { pool } from "./db";
import { generateApiKey } from "./storeauth";
import { bancardSingleBuy, bancardVerifyConfirm } from "./bancard";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ClientRow {
  storeId: number;
  slug: string;
  name: string;
  logo: string | null;
  subId: number;
  planId: number | null;
  planName: string | null;
  status: string; // trialing | active | past_due | canceled
  interval: string; // monthly | yearly
  periodEnd: string | null;
  trialEndsAt: string | null;
  graceDays: number;
  gateway: string | null;
  daysLeft: number | null;
  activeKeys: number;
}

function iso(d: any): string | null {
  return d ? new Date(d).toISOString() : null;
}

// Clientes = lojas que têm assinatura (pega a assinatura mais recente por loja).
export async function getClients(): Promise<ClientRow[]> {
  const rows = await pool.query(
    `SELECT s.id AS storeId, s.slug, s.name, s.logo_url AS logo,
            sub.id AS subId, sub.plan_id AS planId, p.name AS planName,
            sub.status, sub.billing_interval AS \`interval\`,
            sub.current_period_end AS periodEnd, sub.trial_ends_at AS trialEndsAt,
            sub.grace_days AS graceDays, sub.gateway,
            DATEDIFF(sub.current_period_end, NOW()) AS daysLeft,
            (SELECT COUNT(*) FROM api_key k WHERE k.store_id = s.id AND k.revoked = 0) AS activeKeys
     FROM store s
     -- ⚠⚠ LEFT JOIN, NÃO JOIN (22/08/2026). Era 'JOIN subscription', então a
     -- lista só mostrava quem assinou um PLANO. Ele reparou: "se eu escolhi um
     -- lead e ele virar cliente, ele tinha que tá na lista de clientes e não
     -- aparece". Certo — quem compra um banner por US$ 100 é cliente igual, e
     -- sumia da tela porque nunca assinou plano nenhum.
     LEFT JOIN subscription sub ON sub.id = (SELECT MAX(id) FROM subscription WHERE store_id = s.id)
     LEFT JOIN plan p ON p.id = sub.plan_id
     -- A mesma definição de cliente usada no seletor de banners/destaques/blocos.
     WHERE s.is_lead = 0
        OR sub.id IS NOT NULL
        OR EXISTS (SELECT 1 FROM pedido pe WHERE pe.store_id = s.id)
     -- Assinantes ativos primeiro; depois quem vence antes; por último quem só
     -- comprou publicidade (sem assinatura, ordenado por nome).
     ORDER BY sub.status = 'active' DESC, sub.current_period_end ASC, s.name`,
  );
  return rows.map((r: any) => ({
    storeId: Number(r.storeId),
    slug: r.slug,
    name: r.name,
    logo: r.logo ?? null,
    subId: Number(r.subId),
    planId: r.planId != null ? Number(r.planId) : null,
    planName: r.planName ?? null,
    status: r.status,
    interval: r.interval,
    periodEnd: iso(r.periodEnd),
    trialEndsAt: iso(r.trialEndsAt),
    graceDays: Number(r.graceDays ?? 5),
    gateway: r.gateway ?? null,
    daysLeft: r.daysLeft != null ? Number(r.daysLeft) : null,
    activeKeys: Number(r.activeKeys ?? 0),
  }));
}

export async function getClient(storeId: number): Promise<ClientRow | null> {
  const all = await getClients();
  const comAssinatura = all.find((c) => c.storeId === storeId);
  if (comAssinatura) return comAssinatura;

  // ⚠ LOJA SEM ASSINATURA TAMBÉM TEM FICHA (21/08/2026).
  //
  // `getClients()` faz JOIN com `subscription`, então só enxerga quem assinou
  // um plano — hoje **1 loja entre as 163**. A ficha do cliente abria 404 para
  // todas as outras.
  //
  // Isso passou despercebido enquanto a ficha só servia para ver plano e
  // vencimento. Deixou de servir quando ela passou a ter a CONTA DO CLIENTE:
  // vender banner de categoria para uma loja sem plano é o caso normal, não a
  // exceção — e sem ficha não haveria onde lançar o que foi cobrado.
  //
  // 💡 A LISTA continua mostrando só os assinantes, de propósito: as outras 162
  // são possíveis clientes trazidos pelo coletor, e despejá-las ali esconderia
  // quem paga. O que muda é só que a ficha ABRE quando se chega nela.
  const linhas = await pool.query(
    `SELECT s.id AS storeId, s.slug, s.name, s.logo_url AS logo,
            (SELECT COUNT(*) FROM api_key k WHERE k.store_id = s.id AND k.revoked = 0) AS activeKeys
       FROM store s WHERE s.id = ? LIMIT 1`,
    [storeId],
  );
  const r = linhas[0];
  if (!r) return null;
  return {
    storeId: Number(r.storeId),
    slug: r.slug,
    name: r.name,
    logo: r.logo ?? null,
    subId: 0,
    planId: null,
    planName: null,
    status: "sem assinatura",
    interval: "monthly",
    periodEnd: null,
    trialEndsAt: null,
    graceDays: 5,
    gateway: null,
    daysLeft: null,
    activeKeys: Number(r.activeKeys ?? 0),
  } as ClientRow;
}

function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120) || "loja"
  );
}

// Cria uma loja NOVA (cliente que não estava nos leads). Retorna o id.
export async function createStore(name: string): Promise<number> {
  const base = slugify(name);
  let slug = base;
  let n = 1;
  while ((await pool.query("SELECT id FROM store WHERE slug = ? LIMIT 1", [slug])).length) {
    n++;
    slug = `${base}-${n}`;
  }
  const res = await pool.query(
    "INSERT INTO store (slug, name, status, source, is_lead, self_managed) VALUES (?, ?, 'active', 'api', 0, 0)",
    [slug, name],
  );
  return Number(res.insertId);
}

// Lojas candidatas a virar cliente (sem assinatura ativa), para o onboard.
export async function searchOnboardStores(q: string): Promise<Array<{ id: number; name: string; logo: string | null; isLead: boolean }>> {
  const rows = await pool.query(
    `SELECT id, name, logo_url AS logo, is_lead AS isLead FROM store
     WHERE name LIKE ? AND id NOT IN (
       SELECT store_id FROM subscription WHERE status IN ('trialing','active','past_due')
     )
     ORDER BY name LIMIT 20`,
    [`%${q}%`],
  );
  return rows.map((r: any) => ({ id: Number(r.id), name: r.name, logo: r.logo ?? null, isLead: Number(r.isLead) === 1 }));
}

// Onboard: cria a assinatura (trial ou já paga) e marca a loja como cliente.
export async function onboardClient(
  storeId: number,
  planId: number,
  interval: "monthly" | "yearly",
  mode: "trial" | "paid",
): Promise<number> {
  const plan = (await pool.query("SELECT trial_days, price_monthly, price_yearly, currency FROM plan WHERE id = ?", [planId]))[0];
  if (!plan) throw new Error("Plano não encontrado.");
  const existing = await pool.query(
    "SELECT id FROM subscription WHERE store_id = ? AND status IN ('trialing','active','past_due') LIMIT 1",
    [storeId],
  );
  if (existing.length) throw new Error("Esta loja já é cliente (assinatura ativa).");

  const months = interval === "yearly" ? 12 : 1;
  let subId: number;
  if (mode === "trial") {
    const res = await pool.query(
      `INSERT INTO subscription (store_id, plan_id, billing_interval, status, gateway, trial_ends_at, current_period_start, current_period_end, grace_days)
       VALUES (?, ?, ?, 'trialing', 'manual', DATE_ADD(NOW(), INTERVAL ? DAY), NOW(), DATE_ADD(NOW(), INTERVAL ? DAY), 5)`,
      [storeId, planId, interval, Number(plan.trial_days), Number(plan.trial_days)],
    );
    subId = Number(res.insertId);
  } else {
    const res = await pool.query(
      `INSERT INTO subscription (store_id, plan_id, billing_interval, status, gateway, current_period_start, current_period_end, grace_days)
       VALUES (?, ?, ?, 'active', 'manual', NOW(), DATE_ADD(NOW(), INTERVAL ? MONTH), 5)`,
      [storeId, planId, interval, months],
    );
    subId = Number(res.insertId);
    const amount = interval === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
    await pool.query(
      `INSERT INTO payment (store_id, subscription_id, plan_id, amount, currency, method, billing_interval, period_start, period_end, note)
       VALUES (?, ?, ?, ?, ?, 'manual', ?, NOW(), DATE_ADD(NOW(), INTERVAL ? MONTH), 'Cadastro — pago manual')`,
      [storeId, subId, planId, amount, plan.currency, interval, months],
    );
  }
  // Vira cliente: não é mais lead e passa a gerenciar o próprio feed (scraper ignora).
  await pool.query("UPDATE store SET is_lead = 0, status = 'active', self_managed = 1 WHERE id = ?", [storeId]);
  return subId;
}

export interface StoreProfile {
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  mapsQuery: string | null;
  selfManaged: boolean;
}

export async function getStoreProfile(storeId: number): Promise<StoreProfile | null> {
  const rows = await pool.query(
    "SELECT name, slug, logo_url, address, city, phone, external_url, description, maps_query, self_managed FROM store WHERE id = ? LIMIT 1",
    [storeId],
  );
  if (!rows.length) return null;
  const s = rows[0];
  return {
    name: s.name,
    slug: s.slug,
    logoUrl: s.logo_url ?? null,
    address: s.address ?? null,
    city: s.city ?? null,
    phone: s.phone ?? null,
    website: s.external_url ?? null,
    description: s.description ?? null,
    mapsQuery: s.maps_query ?? null,
    selfManaged: Number(s.self_managed) === 1,
  };
}

export async function updateStoreProfile(
  storeId: number,
  p: {
    name?: string;
    logoUrl?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    website?: string | null;
    description?: string | null;
    mapsQuery?: string | null;
    selfManaged?: boolean;
  },
): Promise<void> {
  await pool.query(
    `UPDATE store SET
       name = COALESCE(?, name),
       logo_url = ?, address = ?, city = ?, phone = ?, external_url = ?, description = ?, maps_query = ?,
       self_managed = ?
     WHERE id = ?`,
    [
      p.name?.trim() || null,
      p.logoUrl ?? null,
      p.address ?? null,
      p.city ?? null,
      p.phone ?? null,
      p.website ?? null,
      p.description ?? null,
      p.mapsQuery ?? null,
      p.selfManaged ? 1 : 0,
      storeId,
    ],
  );
}

// Registra pagamento manual: empurra o vencimento (+1 mês ou +12 meses) e grava no histórico.
export async function registerManualPayment(storeId: number, method: "manual" | "bancard" = "manual", note?: string): Promise<void> {
  const sub = (await pool.query(
    "SELECT id, plan_id, billing_interval FROM subscription WHERE store_id = ? ORDER BY id DESC LIMIT 1",
    [storeId],
  ))[0];
  if (!sub) throw new Error("Cliente sem assinatura.");
  const interval = sub.billing_interval as string;
  const months = interval === "yearly" ? 12 : 1;

  await pool.query(
    `UPDATE subscription
     SET status = 'active', gateway = ?,
         current_period_start = GREATEST(NOW(), IFNULL(current_period_end, NOW())),
         current_period_end = DATE_ADD(GREATEST(NOW(), IFNULL(current_period_end, NOW())), INTERVAL ? MONTH)
     WHERE id = ?`,
    [method, months, sub.id],
  );
  const s = (await pool.query("SELECT current_period_start, current_period_end FROM subscription WHERE id = ?", [sub.id]))[0];
  const plan = (await pool.query("SELECT price_monthly, price_yearly, currency FROM plan WHERE id = ?", [sub.plan_id]))[0];
  const amount = interval === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
  await pool.query(
    `INSERT INTO payment (store_id, subscription_id, plan_id, amount, currency, method, billing_interval, period_start, period_end, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [storeId, sub.id, sub.plan_id, amount, plan.currency, method, interval, s.current_period_start, s.current_period_end, note ?? null],
  );
}

export async function changePlan(storeId: number, planId: number, interval: "monthly" | "yearly"): Promise<void> {
  await pool.query(
    "UPDATE subscription SET plan_id = ?, billing_interval = ? WHERE id = (SELECT MAX(id) FROM (SELECT id FROM subscription WHERE store_id = ?) t)",
    [planId, interval, storeId],
  );
}

export async function cancelClient(storeId: number): Promise<void> {
  await pool.query(
    "UPDATE subscription SET status = 'canceled' WHERE id = (SELECT MAX(id) FROM (SELECT id FROM subscription WHERE store_id = ?) t)",
    [storeId],
  );
}

// Chave de API (gerada pelo admin). Revoga as anteriores e devolve a nova (mostrada só 1 vez).
export async function issueApiKey(storeId: number): Promise<string> {
  const { key, prefix, hash } = generateApiKey();
  await pool.query("UPDATE api_key SET revoked = 1 WHERE store_id = ?", [storeId]);
  await pool.query("INSERT INTO api_key (store_id, key_prefix, key_hash, label) VALUES (?, ?, ?, 'admin')", [storeId, prefix, hash]);
  return key;
}

export async function revokeApiKeys(storeId: number): Promise<void> {
  await pool.query("UPDATE api_key SET revoked = 1 WHERE store_id = ?", [storeId]);
}

export async function getKeyInfo(storeId: number): Promise<{ prefix: string; lastUsed: string | null } | null> {
  const rows = await pool.query(
    "SELECT key_prefix, last_used_at FROM api_key WHERE store_id = ? AND revoked = 0 ORDER BY id DESC LIMIT 1",
    [storeId],
  );
  if (!rows.length) return null;
  return { prefix: rows[0].key_prefix, lastUsed: iso(rows[0].last_used_at) };
}

// Cria uma operação de pagamento no Bancard e devolve o process_id (para o checkout).
export async function createBancardCheckout(storeId: number, origin: string): Promise<{ processId: string }> {
  const sub = (await pool.query(
    `SELECT sub.billing_interval, p.name AS planName, p.price_monthly, p.price_yearly, p.currency
     FROM subscription sub LEFT JOIN plan p ON p.id = sub.plan_id
     WHERE sub.store_id = ? ORDER BY sub.id DESC LIMIT 1`,
    [storeId],
  ))[0];
  if (!sub) throw new Error("Cliente sem assinatura.");
  const interval = sub.billing_interval as string;
  const amount = interval === "yearly" ? Number(sub.price_yearly) : Number(sub.price_monthly);
  const currency = sub.currency || "USD";

  const res = await pool.query(
    "INSERT INTO bancard_op (store_id, billing_interval, amount, currency) VALUES (?, ?, ?, ?)",
    [storeId, interval, amount, currency],
  );
  const shopProcessId = Number(res.insertId);
  const returnUrl = `${origin}/pagar/retorno`;
  const processId = await bancardSingleBuy({
    shopProcessId,
    amount,
    currency,
    description: `iCompras ${sub.planName ?? ""}`.trim(),
    returnUrl,
  });
  await pool.query("UPDATE bancard_op SET process_id = ? WHERE shop_process_id = ?", [processId, shopProcessId]);
  return { processId };
}

// Confirma o pagamento (chamado pelo webhook do Bancard): valida token e estende a assinatura.
export async function confirmBancardOp(payload: unknown): Promise<{ ok: boolean }> {
  const check = bancardVerifyConfirm(payload);
  if (check.shopProcessId == null) return { ok: false };
  const op = (await pool.query("SELECT store_id, status FROM bancard_op WHERE shop_process_id = ? LIMIT 1", [check.shopProcessId]))[0];
  if (!op) return { ok: false };
  if (op.status === "paid") return { ok: true }; // idempotente
  if (!check.valid || !check.approved) {
    await pool.query("UPDATE bancard_op SET status = 'failed' WHERE shop_process_id = ?", [check.shopProcessId]);
    return { ok: false };
  }
  await pool.query("UPDATE bancard_op SET status = 'paid' WHERE shop_process_id = ?", [check.shopProcessId]);
  await registerManualPayment(Number(op.store_id), "bancard", `Bancard #${check.shopProcessId}`);
  return { ok: true };
}

export async function getPayments(storeId: number): Promise<Array<{ amount: number; currency: string; method: string; interval: string; periodEnd: string | null; paidAt: string | null; note: string | null }>> {
  const rows = await pool.query(
    "SELECT amount, currency, method, billing_interval AS `interval`, period_end AS periodEnd, paid_at AS paidAt, note FROM payment WHERE store_id = ? ORDER BY paid_at DESC LIMIT 24",
    [storeId],
  );
  return rows.map((r: any) => ({
    amount: Number(r.amount),
    currency: r.currency,
    method: r.method,
    interval: r.interval,
    periodEnd: iso(r.periodEnd),
    paidAt: iso(r.paidAt),
    note: r.note ?? null,
  }));
}

/** Uma foto que a loja mandou e a portaria recusou. */
export interface FotoRecusada {
  externalId: string;
  url: string | null;
  motivo: string;
  quando: string;
}

/**
 * As fotos recusadas de uma loja — o "por quê" que falta ao lojista.
 *
 * A portaria de imagens (packages/core/src/media/seguranca.ts) aceita o
 * produto e descarta só a foto. Sem esta lista, o lojista manda o catálogo,
 * recebe "sucesso" e as fotos somem sem explicação.
 *
 * A linha SOME sozinha quando a loja corrige: a ingestão apaga o registro no
 * primeiro envio em que a foto daquele produto entra.
 */
export async function getFotosRecusadas(storeId: number, limite = 50): Promise<FotoRecusada[]> {
  const rows = await pool.query(
    `SELECT external_id, url, motivo, updated_at
       FROM store_image_reject
      WHERE store_id = ?
      ORDER BY updated_at DESC
      LIMIT ?`,
    [storeId, limite],
  );
  return rows.map((r: { external_id: string; url: string | null; motivo: string; updated_at: Date }) => ({
    externalId: r.external_id,
    url: r.url ?? null,
    motivo: r.motivo,
    quando: new Date(r.updated_at).toISOString(),
  }));
}

/** Quantas fotos de uma loja estão recusadas — para o resumo da lista de clientes. */
export async function contarFotosRecusadas(storeId: number): Promise<number> {
  const [r] = await pool.query("SELECT COUNT(*) n FROM store_image_reject WHERE store_id = ?", [storeId]);
  return Number(r?.n ?? 0);
}
