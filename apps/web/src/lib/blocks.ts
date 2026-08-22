import { pool } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BlockCategory {
  slug: string;
  name: string;
  count: number;
}

export interface CategoryBlock {
  id: number;
  title: string;
  subtitle: string | null;
  icon: string | null;
  categories: BlockCategory[];
  total: number;
  images: string[]; // amostra de fotos para ilustrar o bloco
}

function pick(row: any, base: string, locale: string): string | null {
  const col = locale === "es" ? `${base}_es` : locale === "en" ? `${base}_en` : `${base}_pt`;
  return row[col] || row[`${base}_pt`] || null;
}

// Blocos da home. Categorias sem produto somem, e um bloco que ficou sem
// nenhuma categoria com produto não é devolvido — assim dá para configurar
// blocos antes de o robô encher aquelas categorias, sem mostrar espaço vazio.
export async function getCategoryBlocks(locale: string): Promise<CategoryBlock[]> {
  const blocks = await pool.query(
    `SELECT id, title_pt, title_es, title_en, subtitle_pt, subtitle_es, subtitle_en, icon
       FROM category_block
      WHERE active = 1
        -- ⚠ O PERÍODO MANDA (22/08/2026), como nos banners e destaques: bloco
        -- vendido por um mês tem de sair sozinho no fim do mês. Sem data
        -- continua valendo "sempre" — o caso dos blocos do próprio site.
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at >= NOW())
      ORDER BY position, id`,
  );
  if (!blocks.length) return [];

  const rows = await pool.query(
    `SELECT i.block_id, c.slug, COALESCE(ct.name, c.slug) AS name,
            (SELECT COUNT(*) FROM product p WHERE p.category_id = c.id) AS count
       FROM category_block_item i
       JOIN category c ON c.id = i.category_id
       LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
      ORDER BY i.position, c.position`,
    [locale],
  );

  const porBloco = new Map<number, BlockCategory[]>();
  for (const r of rows) {
    const n = Number(r.count);
    if (!n) continue; // categoria ainda vazia: não aparece
    const id = Number(r.block_id);
    const lista = porBloco.get(id) ?? [];
    lista.push({ slug: r.slug, name: r.name, count: n });
    porBloco.set(id, lista);
  }

  const out: CategoryBlock[] = [];
  for (const b of blocks) {
    const cats = porBloco.get(Number(b.id));
    if (!cats?.length) continue; // bloco inteiro vazio: não aparece

    const images = await pool.query(
      `SELECT p.primary_image_url AS img
         FROM product p
         JOIN category c ON c.id = p.category_id
        WHERE c.slug IN (${cats.map(() => "?").join(",")}) AND p.primary_image_url IS NOT NULL
        ORDER BY p.updated_at DESC LIMIT 4`,
      cats.map((c) => c.slug),
    );

    out.push({
      id: Number(b.id),
      title: pick(b, "title", locale) ?? "",
      subtitle: pick(b, "subtitle", locale),
      icon: b.icon ?? null,
      categories: cats.sort((a, b2) => b2.count - a.count).slice(0, 8),
      total: cats.reduce((n, c) => n + c.count, 0),
      images: images.map((r: any) => r.img as string),
    });
  }
  return out;
}

// Para o painel admin: todos os blocos, inclusive vazios/desligados.
export async function getBlocksForAdmin(): Promise<any[]> {
  const blocks = await pool.query(
    `SELECT b.id, b.title_pt, b.title_es, b.title_en, b.subtitle_pt, b.subtitle_es, b.subtitle_en,
            b.icon, b.position, b.active,
            b.store_id, b.is_paid, b.starts_at, b.ends_at,
            s.name AS store_name, v.numero AS pedido_numero
       FROM category_block b
       LEFT JOIN store s ON s.id = b.store_id
       LEFT JOIN (
         SELECT i.bloco_id, MIN(p.numero) AS numero
           FROM pedido_item i JOIN pedido p ON p.id = i.pedido_id
          WHERE i.bloco_id IS NOT NULL
          GROUP BY i.bloco_id
       ) v ON v.bloco_id = b.id
      ORDER BY b.position, b.id`,
  );
  const items = await pool.query(
    `SELECT i.block_id, c.id AS category_id, c.slug,
            (SELECT COUNT(*) FROM product p WHERE p.category_id = c.id) AS count
       FROM category_block_item i JOIN category c ON c.id = i.category_id
      ORDER BY i.position`,
  );
  return blocks.map((b: any) => ({
    ...b,
    active: Number(b.active) === 1,
    categories: items
      .filter((i: any) => Number(i.block_id) === Number(b.id))
      .map((i: any) => ({ id: Number(i.category_id), slug: i.slug, count: Number(i.count) })),
  }));
}
