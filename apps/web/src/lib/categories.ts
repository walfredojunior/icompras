import { pool } from "./db";

export interface CategoryRow {
  slug: string;
  name: string;
}

export interface CategoryNode extends CategoryRow {
  children: CategoryRow[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// A árvore de categorias espelha a do site de origem e tem mais de 500
// entradas, mas o catálogo só preenche parte delas. O menu mostra apenas
// categorias que têm produtos (uma raiz conta os produtos das suas filhas).
const TREE_SQL = `
  SELECT c.id, c.parent_id, c.slug, COALESCE(ct.name, c.slug) AS name,
         (SELECT COUNT(*) FROM product p WHERE p.category_id = c.id) AS produtos
    FROM category c
    LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
   ORDER BY c.position`;

interface TreeRow {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  produtos: number;
}

async function loadTree(locale: string): Promise<CategoryNode[]> {
  const rows: TreeRow[] = await pool.query(TREE_SQL, [locale]);
  const byId = new Map<number, any>();
  const roots: any[] = [];
  for (const r of rows) {
    byId.set(Number(r.id), { slug: r.slug, name: r.name, produtos: Number(r.produtos), children: [] });
  }
  for (const r of rows) {
    const node = byId.get(Number(r.id));
    if (r.parent_id) byId.get(Number(r.parent_id))?.children.push(node);
    else roots.push(node);
  }
  // Descarta o que está vazio (a raiz herda a contagem das filhas).
  const cheias: CategoryNode[] = [];
  for (const root of roots) {
    const filhas = root.children.filter((c: any) => c.produtos > 0);
    const total = root.produtos + filhas.reduce((n: number, c: any) => n + c.produtos, 0);
    if (total > 0) {
      cheias.push({
        slug: root.slug,
        name: root.name,
        children: filhas.map((c: any) => ({ slug: c.slug, name: c.name })),
      });
    }
  }
  return cheias;
}

// Categorias-raiz (sem subcategorias).
export async function getAllCategories(locale: string): Promise<CategoryRow[]> {
  const tree = await loadTree(locale);
  return tree.map((r) => ({ slug: r.slug, name: r.name }));
}

// Árvore completa: raízes com suas subcategorias.
export async function getCategoryTree(locale: string): Promise<CategoryNode[]> {
  return loadTree(locale);
}

export interface CategoryInfo {
  slug: string;
  name: string;
  parent: CategoryRow | null;
  children: CategoryRow[];
  descendantSlugs: string[]; // o próprio + subcategorias (para filtrar produtos)
}

export async function getCategoryInfo(slug: string, locale: string): Promise<CategoryInfo | null> {
  const rows = await pool.query(
    `SELECT c.id, c.parent_id, c.slug, COALESCE(ct.name, c.slug) AS name
     FROM category c LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE c.slug = ? LIMIT 1`,
    [locale, slug],
  );
  if (!rows.length) return null;
  const cat = rows[0];

  // Só subcategorias com produtos (a árvore da fonte tem muitas vazias).
  const children: CategoryRow[] = await pool.query(
    `SELECT c.slug, COALESCE(ct.name, c.slug) AS name
     FROM category c LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE c.parent_id = ? AND EXISTS (SELECT 1 FROM product p WHERE p.category_id = c.id)
     ORDER BY c.position`,
    [locale, cat.id],
  );

  let parent: CategoryRow | null = null;
  if (cat.parent_id) {
    const p = await pool.query(
      `SELECT c.slug, COALESCE(ct.name, c.slug) AS name
       FROM category c LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
       WHERE c.id = ? LIMIT 1`,
      [locale, cat.parent_id],
    );
    parent = p.length ? p[0] : null;
  }

  return {
    slug: cat.slug,
    name: cat.name,
    parent,
    children,
    descendantSlugs: [cat.slug, ...children.map((c) => c.slug)],
  };
}
