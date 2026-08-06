import { pool } from "@icompras/db";
import { ingerirImagem, getNotificationProvider } from "@icompras/core";
import type { PriceListJob } from "@icompras/queue";
import type { PoolConnection } from "mariadb";

// Verifica alertas de preço para um produto/variante e notifica quem pediu.
async function checkPriceAlerts(
  conn: PoolConnection,
  productId: number,
  variantId: number,
  price: number,
  currency: string,
  productName: string,
  storeName: string,
): Promise<void> {
  const alerts = await conn.query(
    `SELECT a.id, a.user_id, a.channel, u.email
     FROM price_alert a
     JOIN app_user u ON u.id = a.user_id
     WHERE a.active = 1 AND a.product_id = ?
       AND (a.variant_id IS NULL OR a.variant_id = ?)
       AND ? <= a.target_price
       AND (a.last_notified_at IS NULL OR a.last_notified_at < (NOW() - INTERVAL 6 HOUR))`,
    [productId, variantId, price],
  );

  for (const al of alerts) {
    const body = `${productName}: o preço caiu para ${price} ${currency} na ${storeName}.`;
    const provider = getNotificationProvider(al.channel);
    try {
      await provider.send({ to: al.email, subject: "Alerta de preço — iCompras", body });
    } catch {
      // envio real ainda não configurado; segue registrando no log
    }
    await conn.query(
      "INSERT INTO notification_log (user_id, channel, destination, subject, body, alert_id) VALUES (?, ?, ?, ?, ?, ?)",
      [al.user_id, al.channel, al.email, "Alerta de preço — iCompras", body, al.id],
    );
    await conn.query("UPDATE price_alert SET last_notified_at = NOW() WHERE id = ?", [al.id]);
  }
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 190) || "produto"
  );
}

function variantSignature(attributes?: Record<string, string>): string {
  if (!attributes) return "";
  return Object.keys(attributes)
    .sort()
    .map((k) => `${slugify(k)}=${slugify(attributes[k])}`)
    .join(";")
    .slice(0, 250);
}

async function getCategoryId(
  conn: PoolConnection,
  slug: string | undefined,
  cache: Map<string, number | null>,
): Promise<number | null> {
  if (!slug) return null;
  if (cache.has(slug)) return cache.get(slug)!;
  const rows = await conn.query("SELECT id FROM category WHERE slug = ? LIMIT 1", [slug]);
  const id = rows.length ? Number(rows[0].id) : null;
  cache.set(slug, id);
  return id;
}

export async function processPriceList(
  data: PriceListJob,
): Promise<{ processed: number; products: number; variants: number }> {
  const { storeId, items } = data;
  const source = data.source ?? "api";
  const conn = await pool.getConnection();
  const catCache = new Map<string, number | null>();
  const productIds = new Set<number>();
  const variantIds = new Set<number>();
  let processed = 0;

  try {
    const storeRow = await conn.query("SELECT name FROM store WHERE id = ? LIMIT 1", [storeId]);
    const storeName: string = storeRow[0]?.name ?? "loja";

    // Câmbio para normalizar o preço em USD (base de comparação).
    const rateRows = await conn.query("SELECT currency, pyg_value FROM exchange_rate");
    const rates: Record<string, number> = {};
    for (const r of rateRows) rates[r.currency] = Number(r.pyg_value);
    const toUsd = (price: number, currency: string): number => {
      const pc = rates[currency] ?? (currency === "PYG" ? 1 : null);
      const pu = rates["USD"];
      if (!pc || !pu) return price;
      return Math.round((price * pc / pu) * 100) / 100;
    };

    for (const item of items) {
      const productSlug = slugify(`${item.brand ?? ""} ${item.name}`);
      const categoryId = await getCategoryId(conn, item.category, catCache);

      // Produto canônico — dedup ingênuo por slug (Fase 2 substitui por IA/embeddings).
      const pRes = await conn.query(
        `INSERT INTO product (slug, canonical_name, brand, category_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id),
           canonical_name = VALUES(canonical_name),
           category_id = COALESCE(product.category_id, VALUES(category_id))`,
        [productSlug, item.name, item.brand ?? null, categoryId],
      );
      const productId = Number(pRes.insertId);
      productIds.add(productId);

      // Variante — identificada pela assinatura dos atributos (cor/tamanho...).
      const sig = variantSignature(item.attributes);
      const title = item.attributes
        ? Object.entries(item.attributes)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : null;
      const vRes = await conn.query(
        `INSERT INTO product_variant (product_id, signature, title)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), title = VALUES(title)`,
        [productId, sig, title],
      );
      const variantId = Number(vRes.insertId);
      variantIds.add(variantId);

      // Atributos da variante (recria o conjunto — idempotente).
      await conn.query("DELETE FROM variant_attribute WHERE variant_id = ?", [variantId]);
      if (item.attributes) {
        for (const [k, v] of Object.entries(item.attributes)) {
          await conn.query(
            "INSERT INTO variant_attribute (variant_id, attr_key, value_slug, value_label) VALUES (?, ?, ?, ?)",
            [variantId, slugify(k), slugify(v), v],
          );
        }
      }

      // Oferta (loja + preço) — única por (store_id, external_id).
      const externalId = item.external_id ?? `${productSlug}#${sig}`;
      const prev = await conn.query(
        "SELECT id, price FROM offer WHERE store_id = ? AND external_id = ? LIMIT 1",
        [storeId, externalId],
      );
      const oRes = await conn.query(
        `INSERT INTO offer (variant_id, store_id, price, currency, price_usd, url, image_url, in_stock, stock, source, external_id, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           variant_id = VALUES(variant_id), price = VALUES(price), currency = VALUES(currency),
           price_usd = VALUES(price_usd),
           url = VALUES(url), image_url = VALUES(image_url), in_stock = VALUES(in_stock),
           stock = VALUES(stock),
           last_seen_at = NOW()`,
        [
          variantId,
          storeId,
          item.price,
          item.currency,
          toUsd(Number(item.price), item.currency),
          item.url ?? null,
          item.image_url ?? null,
          // Quem manda `stock: 0` sai do site; quem não manda o campo continua
          // no ar (loja sem controle de estoque não pode sumir por engano).
          item.stock !== undefined ? (item.stock > 0 ? 1 : 0) : item.in_stock ? 1 : 0,
          item.stock ?? null,
          source,
          externalId,
        ],
      );
      const offerId = prev.length ? Number(prev[0].id) : Number(oRes.insertId);

      // Histórico de preço — grava quando é novo ou o preço mudou.
      const priceChanged = !prev.length || Number(prev[0].price) !== Number(item.price);
      if (priceChanged) {
        await conn.query(
          "INSERT INTO offer_price_history (offer_id, price, currency) VALUES (?, ?, ?)",
          [offerId, item.price, item.currency],
        );
      }

      // Alertas de queda de preço.
      await checkPriceAlerts(
        conn,
        productId,
        variantId,
        Number(item.price),
        item.currency,
        item.name,
        storeName,
      );

      // Imagem — otimiza e armazena só se o produto ainda não tem foto.
      if (item.image_url) {
        const existing = await conn.query("SELECT primary_image_url FROM product WHERE id = ?", [productId]);
        if (!existing[0]?.primary_image_url) {
          const { url: stored, recusa } = await ingerirImagem(item.image_url);
          if (stored) {
            await conn.query("UPDATE product SET primary_image_url = ? WHERE id = ?", [stored, productId]);
            await conn.query("UPDATE product_variant SET image_url = COALESCE(image_url, ?) WHERE id = ?", [stored, variantId]);
            // Deu certo agora: some a queixa antiga daquele produto.
            await conn.query("DELETE FROM store_image_reject WHERE store_id = ? AND external_id = ?", [
              storeId,
              externalId,
            ]);
          } else if (recusa) {
            // A FOTO NÃO DERRUBA O PRODUTO (decisão do dono, 06/08/2026) — mas o
            // silêncio também não serve: a loja mandaria o catálogo, receberia
            // "sucesso" e as fotos sumiriam sem explicação. Fica registrado aqui
            // e aparece em Admin › Clientes › (loja).
            await conn.query(
              `INSERT INTO store_image_reject (store_id, external_id, url, motivo)
               VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE url = VALUES(url), motivo = VALUES(motivo),
                 updated_at = CURRENT_TIMESTAMP`,
              [storeId, externalId, item.image_url.slice(0, 600), recusa],
            );
          }
        }
      }

      processed++;
    }

    return { processed, products: productIds.size, variants: variantIds.size };
  } finally {
    conn.release();
  }
}
