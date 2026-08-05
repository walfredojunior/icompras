import { pool } from "./db";
import { toUsd } from "./money";
import type { Rates } from "./rates";
import type { ProductHit } from "./search";

export interface ProductStore {
  id: number;
  slug: string;
  name: string;
  logo: string | null;
  phone: string | null; // WhatsApp da loja, quando o coletor capturou
  priceUsd: number | null; // preço só quando vem de uma oferta real (loja via API)
  // Dados da oferta daquela loja: cada uma anuncia a sua variação.
  offerTitle: string | null;
  offerCode: string | null;
  offerImage: string | null;
}

export interface ProductDetail {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  colors: string[];
  minUsd: number | null;
  stores: ProductStore[];
  specs: Array<{ k: string; v: string }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const prod = await pool.query(
    "SELECT id, slug, canonical_name AS name, brand, primary_image_url AS image_url, min_price_usd, specs FROM product WHERE slug = ? LIMIT 1",
    [slug],
  );
  if (!prod.length) return null;
  const p = prod[0];
  const pid = Number(p.id);

  let specs: Array<{ k: string; v: string }> = [];
  if (p.specs) {
    try {
      specs = typeof p.specs === "string" ? JSON.parse(p.specs) : p.specs;
    } catch {
      specs = [];
    }
  }

  const colorRows = await pool.query(
    "SELECT DISTINCT va.value_label FROM variant_attribute va JOIN product_variant v ON v.id = va.variant_id WHERE v.product_id = ? AND va.attr_key = 'color'",
    [pid],
  );
  const colors = colorRows.map((r: any) => r.value_label);

  // Lojas com oferta real (via API) — têm preço.
  const offers = await pool.query(
    `SELECT s.id, s.slug, s.name, s.logo_url AS logo, s.phone, MIN(o.price_usd) AS price,
            SUBSTRING_INDEX(GROUP_CONCAT(o.title ORDER BY o.price_usd SEPARATOR 0x1f), 0x1f, 1) AS offer_title,
            SUBSTRING_INDEX(GROUP_CONCAT(o.code ORDER BY o.price_usd SEPARATOR 0x1f), 0x1f, 1) AS offer_code,
            SUBSTRING_INDEX(GROUP_CONCAT(o.image_url ORDER BY o.price_usd SEPARATOR 0x1f), 0x1f, 1) AS offer_image
     FROM offer o JOIN product_variant v ON v.id = o.variant_id JOIN store s ON s.id = o.store_id
     WHERE v.product_id = ? AND o.in_stock = 1 GROUP BY s.id ORDER BY price ASC`,
    [pid],
  );

  // Lojas do agregador (sem preço por loja).
  const scraped = await pool.query(
    "SELECT s.id, s.slug, s.name, s.logo_url AS logo, s.phone FROM product_store ps JOIN store s ON s.id = ps.store_id WHERE ps.product_id = ? ORDER BY s.name",
    [pid],
  );

  const seen = new Set<string>();
  const stores: ProductStore[] = [];
  for (const o of offers) {
    stores.push({ id: Number(o.id), slug: o.slug, name: o.name, logo: o.logo ?? null, phone: o.phone ?? null, priceUsd: Number(o.price), offerTitle: o.offer_title ?? null, offerCode: o.offer_code ?? null, offerImage: o.offer_image ?? null });
    seen.add(o.slug);
  }
  for (const s of scraped) {
    if (!seen.has(s.slug)) {
      stores.push({ id: Number(s.id), slug: s.slug, name: s.name, logo: s.logo ?? null, phone: s.phone ?? null, priceUsd: null, offerTitle: null, offerCode: null, offerImage: null });
      seen.add(s.slug);
    }
  }

  const offerMin = offers.length ? Number(offers[0].price) : null;
  const pmin = p.min_price_usd != null ? Number(p.min_price_usd) : null;
  const candidates = [offerMin, pmin].filter((v): v is number => v != null);
  const minUsd = candidates.length ? Math.min(...candidates) : null;

  return {
    id: pid,
    slug: p.slug,
    name: p.name,
    brand: p.brand ?? null,
    image_url: p.image_url ?? null,
    colors,
    minUsd,
    stores,
    specs,
  };
}

// Caminho de migalhas: raiz → subcategoria (nomes no idioma), para navegar de volta.
export async function getProductBreadcrumb(
  slug: string,
  locale: string,
): Promise<Array<{ slug: string; name: string }>> {
  const rows = await pool.query("SELECT category_id FROM product WHERE slug = ? LIMIT 1", [slug]);
  if (!rows.length || rows[0].category_id == null) return [];
  let catId: number | null = Number(rows[0].category_id);
  const chain: Array<{ slug: string; name: string }> = [];
  let guard = 0;
  while (catId != null && guard++ < 6) {
    const c = await pool.query(
      `SELECT c.slug, c.parent_id, COALESCE(ct.name, c.slug) AS name
       FROM category c LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
       WHERE c.id = ? LIMIT 1`,
      [locale, catId],
    );
    if (!c.length) break;
    chain.unshift({ slug: c[0].slug, name: c[0].name });
    catId = c[0].parent_id != null ? Number(c[0].parent_id) : null;
  }
  return chain;
}

// Produtos relacionados por similaridade (IA / embeddings VECTOR do MariaDB).
export async function getRelatedProducts(productId: number, limit = 6): Promise<ProductHit[]> {
  const rows = await pool.query(
    `SELECT p.id, p.slug, p.canonical_name AS name, p.brand, p.primary_image_url AS image_url,
            COALESCE((SELECT MIN(o.price_usd) FROM offer o JOIN product_variant v ON v.id = o.variant_id WHERE v.product_id = p.id AND o.in_stock = 1), p.min_price_usd) AS min_price,
            GREATEST(
              (SELECT COUNT(DISTINCT o.store_id) FROM offer o JOIN product_variant v ON v.id = o.variant_id WHERE v.product_id = p.id AND o.in_stock = 1),
              p.ext_store_count
            ) AS store_count
     FROM product_embedding e1
     JOIN product_embedding e2 ON e2.product_id <> e1.product_id
     JOIN product p ON p.id = e2.product_id
     WHERE e1.product_id = ?
     ORDER BY VEC_DISTANCE_COSINE(e1.embedding, e2.embedding) ASC
     LIMIT ?`,
    [productId, limit],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    brand: r.brand ?? "",
    category: "",
    image_url: r.image_url ?? null,
    min_price: r.min_price != null ? Number(r.min_price) : null,
    store_count: Number(r.store_count ?? 0),
    colors: [],
  }));
}

export async function getPriceHistory(
  productId: number,
  rates: Rates,
): Promise<Array<{ day: string; usd: number }>> {
  const rows = await pool.query(
    `SELECT h.recorded_at, h.price, h.currency
     FROM offer_price_history h
     JOIN offer o ON o.id = h.offer_id
     JOIN product_variant v ON v.id = o.variant_id
     WHERE v.product_id = ?
     ORDER BY h.recorded_at ASC`,
    [productId],
  );
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const usd = toUsd(Number(r.price), r.currency, rates);
    const day = new Date(r.recorded_at).toISOString().slice(0, 10);
    byDay.set(day, Math.min(byDay.get(day) ?? Infinity, usd));
  }
  return [...byDay.entries()].map(([day, usd]) => ({ day, usd: Math.round(usd * 100) / 100 }));
}
