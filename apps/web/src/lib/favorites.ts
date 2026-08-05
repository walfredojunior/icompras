import { pool } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Favoritos: "guardar para ver depois".
//
// É diferente do ALERTA DE PREÇO, que já existia: o alerta avisa quando o
// preço cai abaixo de um valor escolhido. O favorito é só uma lista pessoal.
// As duas coisas convivem — da lista de favoritos dá para criar um alerta.

export async function isFavorite(userId: number, productId: number): Promise<boolean> {
  const r = await pool.query("SELECT 1 FROM favorite WHERE user_id = ? AND product_id = ? LIMIT 1", [
    userId,
    productId,
  ]);
  return r.length > 0;
}

export async function toggleFavorite(userId: number, productId: number): Promise<boolean> {
  if (await isFavorite(userId, productId)) {
    await pool.query("DELETE FROM favorite WHERE user_id = ? AND product_id = ?", [userId, productId]);
    return false;
  }
  await pool.query("INSERT IGNORE INTO favorite (user_id, product_id) VALUES (?, ?)", [userId, productId]);
  return true;
}

export interface FavoriteItem {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  image: string | null;
  minUsd: number | null;
  stores: number;
}

export async function getFavorites(userId: number): Promise<FavoriteItem[]> {
  const rows = await pool.query(
    `SELECT p.id, p.slug, p.canonical_name AS name, p.brand, p.primary_image_url AS image,
            LEAST(IFNULL(MIN(o.price_usd), p.min_price_usd), IFNULL(p.min_price_usd, MIN(o.price_usd))) AS min_usd,
            GREATEST(COUNT(DISTINCT o.store_id), MAX(p.ext_store_count)) AS stores
       FROM favorite f
       JOIN product p ON p.id = f.product_id
       LEFT JOIN product_variant v ON v.product_id = p.id
       LEFT JOIN offer o ON o.variant_id = v.id AND o.in_stock = 1
      WHERE f.user_id = ?
      GROUP BY p.id
      ORDER BY MAX(f.created_at) DESC`,
    [userId],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    brand: r.brand ?? null,
    image: r.image ?? null,
    minUsd: r.min_usd != null ? Number(r.min_usd) : null,
    stores: Number(r.stores ?? 0),
  }));
}
