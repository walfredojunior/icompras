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
       FROM category_block WHERE active = 1 ORDER BY position, id`,
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
    `SELECT id, title_pt, title_es, title_en, subtitle_pt, subtitle_es, subtitle_en, icon, position, active
       FROM category_block ORDER BY position, id`,
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
