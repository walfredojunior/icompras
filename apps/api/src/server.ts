import "./env.js";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { ping, pool } from "@icompras/db";
import { hashApiKey, PriceListSchema } from "@icompras/core";
import { priceListQueue } from "@icompras/queue";

declare module "fastify" {
  interface FastifyRequest {
    storeId?: number;
  }
}

function extractKey(req: FastifyRequest): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const x = req.headers["x-api-key"];
  if (typeof x === "string" && x.length) return x.trim();
  return null;
}

// Autentica a loja pela chave de API (SHA-256 comparado ao banco).
async function authStore(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = extractKey(req);
  if (!key) {
    reply.code(401).send({ error: "Chave de API ausente. Use o header Authorization: Bearer <chave>." });
    return;
  }
  const rows: Array<{ id: number; store_id: number }> = await pool.query(
    "SELECT id, store_id FROM api_key WHERE key_hash = ? AND revoked = 0 LIMIT 1",
    [hashApiKey(key)],
  );
  if (!rows.length) {
    reply.code(401).send({ error: "Chave de API inválida." });
    return;
  }
  req.storeId = rows[0].store_id;
  void pool.query("UPDATE api_key SET last_used_at = NOW() WHERE id = ?", [rows[0].id]).catch(() => {});
}

// Verifica assinatura (venceu? cancelada?) e limites do plano antes de aceitar a lista.
async function checkBilling(
  storeId: number,
  itemCount: number,
): Promise<{ ok: true } | { ok: false; code: number; error: string }> {
  const subs: Array<{
    status: string;
    current_period_end: string | null;
    grace_days: number;
    max_products: number;
    max_api_requests_per_day: number;
  }> = await pool.query(
    `SELECT sub.status, sub.current_period_end, sub.grace_days,
            p.max_products, p.max_api_requests_per_day
     FROM subscription sub LEFT JOIN plan p ON p.id = sub.plan_id
     WHERE sub.store_id = ? ORDER BY sub.id DESC LIMIT 1`,
    [storeId],
  );
  if (!subs.length) {
    return { ok: false, code: 402, error: "Loja sem assinatura ativa. Contate o administrador do iCompras." };
  }
  const s = subs[0];
  if (s.status === "canceled") {
    return { ok: false, code: 402, error: "Assinatura cancelada." };
  }
  if (s.current_period_end) {
    const end = new Date(s.current_period_end).getTime();
    const grace = Number(s.grace_days ?? 5) * 86400000;
    if (Date.now() > end + grace) {
      return { ok: false, code: 402, error: "Assinatura vencida. Regularize o pagamento para reativar o envio de preços." };
    }
  }
  const maxP = Number(s.max_products ?? 0);
  if (maxP > 0 && itemCount > maxP) {
    return { ok: false, code: 413, error: `Seu plano permite até ${maxP} produtos por envio (recebido: ${itemCount}). Faça upgrade do plano.` };
  }
  const maxReq = Number(s.max_api_requests_per_day ?? 0);
  if (maxReq > 0) {
    const cnt: Array<{ count: number }> = await pool.query(
      "SELECT count FROM api_usage WHERE store_id = ? AND day = CURDATE()",
      [storeId],
    );
    const used = cnt.length ? Number(cnt[0].count) : 0;
    if (used >= maxReq) {
      return { ok: false, code: 429, error: `Limite diário de ${maxReq} requisições atingido. Tente novamente amanhã ou faça upgrade.` };
    }
  }
  return { ok: true };
}

export function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    const db = await ping().catch(() => false);
    return { status: "ok", db, time: new Date().toISOString() };
  });

  // Ingestão de lista de preços: valida, enfileira e responde 202.
  app.post("/v1/price-list", { preHandler: authStore }, async (req, reply) => {
    const parsed = PriceListSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Payload inválido.", issues: parsed.error.issues });
    }

    // Cobrança "com dente": assinatura válida + limites do plano.
    const billing = await checkBilling(req.storeId!, parsed.data.items.length);
    if (!billing.ok) {
      return reply.code(billing.code).send({ error: billing.error });
    }

    const job = await priceListQueue.add("ingest", {
      storeId: req.storeId!,
      items: parsed.data.items,
    });
    // Conta a requisição do dia (limite por plano).
    void pool
      .query(
        "INSERT INTO api_usage (store_id, day, count) VALUES (?, CURDATE(), 1) ON DUPLICATE KEY UPDATE count = count + 1",
        [req.storeId!],
      )
      .catch(() => {});
    return reply.code(202).send({ accepted: true, jobId: job.id, received: parsed.data.items.length });
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  const app = buildServer();
  const port = Number(process.env.API_PORT ?? 3001);
  app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
