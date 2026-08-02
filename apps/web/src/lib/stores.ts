import { pool } from "./db";
import type { ProductHit } from "./search";

export interface StoreDetail {
  id: number;
  slug: string;
  name: string;
  logo: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  description: string | null;
  website: string | null;
  mapsQuery: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function getStore(slug: string): Promise<StoreDetail | null> {
  const rows = await pool.query(
    "SELECT id, slug, name, logo_url, address, city, phone, description, external_url, maps_query FROM store WHERE slug = ? LIMIT 1",
    [slug],
  );
  if (!rows.length) return null;
  const s = rows[0];
  return {
    id: Number(s.id),
    slug: s.slug,
    name: s.name,
    logo: s.logo_url ?? null,
    address: s.address ?? null,
    city: s.city ?? null,
    phone: s.phone ?? null,
    description: s.description ?? null,
    website: s.external_url ?? null,
    mapsQuery: s.maps_query || `${s.name}, Paraguay`,
  };
}

export interface StoreListItem {
  slug: string;
  name: string;
  logo: string | null;
  city: string | null;
  productCount: number;
}

// Diretório de lojas: só as que têm produtos, ordenadas por quantidade.
export async function getStoresList(): Promise<StoreListItem[]> {
  const rows = await pool.query(
    `SELECT s.slug, s.name, s.logo_url AS logo, s.city,
            COUNT(DISTINCT ps.product_id) AS product_count
     FROM store s
     JOIN product_store ps ON ps.store_id = s.id
     GROUP BY s.id
     HAVING product_count > 0
     ORDER BY product_count DESC, s.name`,
  );
  return rows.map((r: any) => ({
    slug: r.slug,
    name: r.name,
    logo: r.logo ?? null,
    city: r.city ?? null,
    productCount: Number(r.product_count ?? 0),
  }));
}

export async function getStoreProducts(storeId: number, limit = 24): Promise<ProductHit[]> {
  const rows = await pool.query(
    `SELECT p.id, p.slug, p.canonical_name AS name, p.brand, p.primary_image_url AS image_url,
       COALESCE((SELECT MIN(o.price_usd) FROM offer o JOIN product_variant v ON v.id = o.variant_id WHERE v.product_id = p.id), p.min_price_usd) AS min_price,
       GREATEST((SELECT COUNT(DISTINCT o.store_id) FROM offer o JOIN product_variant v ON v.id = o.variant_id WHERE v.product_id = p.id), p.ext_store_count) AS store_count
     FROM product p
     WHERE p.id IN (SELECT product_id FROM product_store WHERE store_id = ?)
        OR p.id IN (SELECT v.product_id FROM offer o JOIN product_variant v ON v.id = o.variant_id WHERE o.store_id = ?)
     ORDER BY p.canonical_name
     LIMIT ?`,
    [storeId, storeId, limit],
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
