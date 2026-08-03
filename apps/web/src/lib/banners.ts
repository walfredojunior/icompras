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
  /** Endereço da loja aqui no iCompras — vira o destino quando o banner aponta para ela. */
  store_slug?: string | null;
  /** busca | marca | loja | link | nenhum | auto (ver lib/bannerDestino.ts). */
  destino_tipo?: string | null;
  /** Termo da busca pronta, ou o nome da marca. */
  busca?: string | null;
  /** Cliques nos últimos 30 dias (só no painel). */
  cliques30?: number;
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
  // O slug da loja vem junto: é o destino quando o banner aponta para a loja.
  // destino_tipo e busca decidem o resto (ver lib/bannerDestino.ts).
  return pool.query(
    `SELECT b.id, b.title, b.image_url, b.link_url, b.destino_tipo, b.busca,
            b.placement, b.category_slug, b.is_paid, b.store_id, s.slug AS store_slug
       FROM banner b
       LEFT JOIN store s ON s.id = b.store_id
      WHERE ${where}
      ORDER BY b.position, b.id DESC`,
    params,
  );
}

// Todos os banners (para o admin), com o nome da loja e os cliques do mês.
export async function getAllBanners(): Promise<Banner[]> {
  return pool.query(
    `SELECT b.id, b.title, b.image_url, b.link_url, b.destino_tipo, b.busca,
            b.placement, b.category_slug, b.is_paid, b.active,
            b.store_id, s.name AS store_name, s.slug AS store_slug,
            COALESCE(c.cliques, 0) AS cliques30
     FROM banner b
     LEFT JOIN store s ON s.id = b.store_id
     LEFT JOIN (
       SELECT banner_id, SUM(clicks) AS cliques
         FROM analytics_banner_click
        WHERE day > CURDATE() - INTERVAL 30 DAY
        GROUP BY banner_id
     ) c ON c.banner_id = b.id
     ORDER BY b.placement, b.position, b.id DESC`,
  );
}

// Marcas do catálogo, para a lista de sugestão do banner "por marca".
//
// Vêm do banco e não do Meilisearch de propósito: o valor precisa ser
// EXATAMENTE o mesmo texto que está indexado, senão o filtro `brand IN [...]`
// não casa e o banner leva a uma página vazia.
export async function getMarcas(limite = 800): Promise<Array<{ marca: string; produtos: number }>> {
  const rows = await pool.query(
    `SELECT brand, COUNT(*) AS n
       FROM product
      WHERE brand IS NOT NULL AND brand <> ''
      GROUP BY brand
      ORDER BY n DESC
      LIMIT ?`,
    [limite],
  );
  return rows.map((r: any) => ({ marca: String(r.brand), produtos: Number(r.n) }));
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
