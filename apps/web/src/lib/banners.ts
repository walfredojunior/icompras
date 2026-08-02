import { pool } from "./db";

export interface Banner {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
  placement: string;
  category_slug: string | null;
  is_paid: number;
  active: number;
  store_id?: number | null;
  store_name?: string | null;
  /** Endereço da loja aqui no iCompras — vira o destino quando o banner não tem link próprio. */
  store_slug?: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Banners ativos de um "lugar" (home_hero, ou category de um slug), respeitando o período.
export async function getActiveBanners(placement: string, categorySlug?: string): Promise<Banner[]> {
  const params: any[] = [placement];
  // Colunas prefixadas com b. desde o começo: agora há um JOIN com store e
  // "active" sem dono seria ambíguo.
  let where =
    "b.placement = ? AND b.active = 1 AND (b.starts_at IS NULL OR b.starts_at <= NOW()) AND (b.ends_at IS NULL OR b.ends_at >= NOW())";
  if (placement === "category") {
    where += " AND b.category_slug = ?";
    params.push(categorySlug ?? "");
  }
  // O slug da loja vem junto: banner sem link próprio vai para a página da
  // loja aqui no iCompras (ver BannerCarousel).
  return pool.query(
    `SELECT b.id, b.title, b.image_url, b.link_url, b.placement, b.category_slug, b.is_paid,
            b.store_id, s.slug AS store_slug
       FROM banner b
       LEFT JOIN store s ON s.id = b.store_id
      WHERE ${where}
      ORDER BY b.position, b.id DESC`,
    params,
  );
}

// Todos os banners (para o admin), com o nome da loja quando for pago.
export async function getAllBanners(): Promise<Banner[]> {
  return pool.query(
    `SELECT b.id, b.title, b.image_url, b.link_url, b.placement, b.category_slug, b.is_paid, b.active,
            b.store_id, s.name AS store_name
     FROM banner b LEFT JOIN store s ON s.id = b.store_id
     ORDER BY b.placement, b.position, b.id DESC`,
  );
}

export interface FeaturedProduct {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  min_price: number | null;
}

export async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  return pool.query(
    `SELECT p.id, p.slug, p.canonical_name AS name, p.brand, p.primary_image_url AS image_url,
            MIN(o.price_usd) AS min_price
     FROM featured_product f
     JOIN product p ON p.id = f.product_id
     LEFT JOIN product_variant v ON v.product_id = p.id
     LEFT JOIN offer o ON o.variant_id = v.id
     GROUP BY p.id, f.position
     ORDER BY f.position, p.id`,
  );
}
