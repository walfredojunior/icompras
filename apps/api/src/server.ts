import "./env.js";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { ping, pool } from "@icompras/db";
import { hashApiKey, PriceListSchema } from "@icompras/core";
import { priceListQueue } from "@icompras/queue";
import { validarLote, paraNosso, type ResultadoImport } from "./compat.js";
import { documento, paginaSwagger } from "./openapi.js";

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
  // `token`: é assim que o Compras Paraguai autentica. Aceitar o cabeçalho
  // deles faz a loja que já integra com eles precisar mudar só o endereço e a
  // chave — nenhuma linha da lógica dela.
  const t = req.headers["token"];
  if (typeof t === "string" && t.length) return t.trim();
  return null;
}

// Autentica a loja pela chave de API (SHA-256 comparado ao banco).
async function authStore(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = extractKey(req);
  if (!key) {
    reply
      .code(401)
      .send({ error: "Chave da loja ausente. Use o header `token: <chave>` ou `Authorization: Bearer <chave>`." });
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

  // -------------------------------------------------------------------------
  // COMPATÍVEL COM O COMPRAS PARAGUAI (ver src/compat.ts)
  // Mesmos endereços, mesmo cabeçalho, mesmo JSON.
  // -------------------------------------------------------------------------

  app.post("/api/products/import/", { preHandler: authStore }, async (req, reply) => {
    const { ok, erros, formatoInvalido } = validarLote(req.body);
    if (formatoInvalido) {
      return reply.code(400).send({ success: false, message: formatoInvalido });
    }
    if (!ok.length && !erros.length) {
      return reply.code(400).send({ success: false, message: "Lista vazia." });
    }

    // Os limites do plano valem pelo que veio, não pelo que passou na
    // validação: quem manda 10 mil itens ruins consome recurso igual.
    const billing = await checkBilling(req.storeId!, ok.length + erros.length);
    if (!billing.ok) {
      return reply.code(billing.code).send({ success: false, message: billing.error });
    }

    if (ok.length) {
      await priceListQueue.add("ingest", { storeId: req.storeId!, items: ok.map(paraNosso) });
    }
    void pool
      .query(
        "INSERT INTO api_usage (store_id, day, count) VALUES (?, CURDATE(), 1) ON DUPLICATE KEY UPDATE count = count + 1",
        [req.storeId!],
      )
      .catch(() => {});

    // 207 (Multi-Status) mesmo quando tudo deu certo — é o que o cliente do
    // Compras Paraguai já espera, e evita que ele trate 200/207 diferente.
    const saida: ResultadoImport = {
      success: erros.length === 0,
      message: erros.length
        ? `${ok.length} produto(s) aceito(s), ${erros.length} recusado(s).`
        : "Importação concluída.",
      products_processed: ok.length,
      products_failed: erros.length,
      validation_errors: erros,
    };
    return reply.code(207).send(saida);
  });

  app.get("/api/products/list/", { preHandler: authStore }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const bool = (v?: string) => (v === undefined ? undefined : v === "true" || v === "1");
    const page = Math.max(1, Number(q.page ?? 1) || 1);
    const porPagina = 100;

    const where: string[] = ["o.store_id = ?"];
    const params: unknown[] = [req.storeId!];
    if (q.code) {
      where.push("o.external_id = ?");
      params.push(q.code);
    }
    if (q.name) {
      where.push("p.canonical_name LIKE ?");
      params.push(`%${q.name}%`);
    }
    const disponivel = bool(q.available);
    if (disponivel !== undefined) {
      where.push("o.in_stock = ?");
      params.push(disponivel ? 1 : 0);
    }
    const comEstoque = bool(q.with_stock);
    if (comEstoque !== undefined) {
      where.push(comEstoque ? "o.stock > 0" : "(o.stock = 0 OR o.stock IS NULL)");
    }
    const filtro = where.join(" AND ");

    const [tot]: Array<{ n: number }> = await pool.query(
      `SELECT COUNT(*) n FROM offer o
         JOIN product_variant v ON v.id = o.variant_id
         JOIN product p ON p.id = v.product_id
        WHERE ${filtro}`,
      params,
    );
    const count = Number(tot?.n ?? 0);

    // O que a loja mais quer saber não é o que ela mandou (ela já sabe), e sim
    // COMO o iCompras entendeu: em que produto caiu, que categoria recebeu e
    // quantas lojas disputam aquele produto com ela.
    const linhas = await pool.query(
      `SELECT o.external_id AS code, p.id, p.slug, p.canonical_name AS name,
              o.price, o.price_usd, o.stock, o.in_stock, o.url, o.image_url,
              c.slug AS category, o.last_seen_at AS updated_at,
              (SELECT COUNT(DISTINCT o2.store_id)
                 FROM offer o2 JOIN product_variant v2 ON v2.id = o2.variant_id
                WHERE v2.product_id = p.id) AS stores_count
         FROM offer o
         JOIN product_variant v ON v.id = o.variant_id
         JOIN product p ON p.id = v.product_id
         LEFT JOIN category c ON c.id = p.category_id
        WHERE ${filtro}
        ORDER BY o.last_seen_at DESC, o.id DESC
        LIMIT ? OFFSET ?`,
      [...params, porPagina, (page - 1) * porPagina],
    );

    const site = process.env.SITE_URL ?? "https://icompras.com.py";
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return reply.send({
      count,
      page,
      pages: Math.max(1, Math.ceil(count / porPagina)),
      data: linhas.map((r: any) => ({
        id: Number(r.id),
        code: r.code,
        name: r.name,
        price: r.price != null ? Number(r.price) : null,
        price_usd: r.price_usd != null ? Number(r.price_usd) : null,
        stock: r.stock != null ? Number(r.stock) : null,
        in_stock: !!r.in_stock,
        url: r.url ?? null,
        image_url: r.image_url ?? null,
        icompras_url: `${site}/pt-BR/produto/${r.slug}`,
        category: r.category ?? null,
        stores_count: Number(r.stores_count ?? 0),
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      })),
    });
  });

  // Documentação. `/api/schema/` é o arquivo; `/api/schema/swagger-ui/` é a
  // página — os mesmos endereços do Compras Paraguai, para quem já conhece.
  const baseUrl = () => process.env.SITE_URL ?? "https://icompras.com.py";
  app.get("/api/schema/", async (_req, reply) =>
    reply.type("application/vnd.oai.openapi+json; charset=utf-8").send(documento(baseUrl())),
  );
  app.get("/api/schema/swagger-ui/", async (_req, reply) =>
    reply.type("text/html; charset=utf-8").send(paginaSwagger()),
  );

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
