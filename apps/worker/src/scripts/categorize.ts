import "../env.js";
import { pool } from "@icompras/db";
import {
  buildCategoryVectors,
  buildVectors,
  suggestCategory,
  nearestFrom,
  SUBCATEGORY_SEEDS,
} from "@icompras/core";

const SUB_THRESHOLD = Number(process.env.SUBCATEGORY_THRESHOLD ?? 0.9);

async function main(): Promise<void> {
  const rootVectors = buildCategoryVectors();
  const subVectors = buildVectors(SUBCATEGORY_SEEDS);

  const cats = await pool.query("SELECT id, slug, parent_id FROM category");
  const idBySlug = new Map<string, number>(cats.map((c: any) => [c.slug, Number(c.id)]));
  const slugById = new Map<number, string>(cats.map((c: any) => [Number(c.id), c.slug]));
  const childrenByParent = new Map<string, string[]>();
  for (const c of cats) {
    if (c.parent_id) {
      const parentSlug = slugById.get(Number(c.parent_id));
      if (parentSlug) {
        if (!childrenByParent.has(parentSlug)) childrenByParent.set(parentSlug, []);
        childrenByParent.get(parentSlug)!.push(c.slug);
      }
    }
  }

  const products = await pool.query("SELECT id, brand, canonical_name, category_id FROM product");
  let rootAssigned = 0;
  let refined = 0;

  for (const p of products) {
    const text = `${p.brand ?? ""} ${p.canonical_name}`.trim();
    let currentSlug: string | null = p.category_id ? slugById.get(Number(p.category_id)) ?? null : null;

    // 1) Sem categoria → escolhe a raiz.
    if (!currentSlug) {
      const s = suggestCategory(text, rootVectors);
      if (!s.slug) continue;
      await pool.query("UPDATE product SET category_id = ? WHERE id = ?", [idBySlug.get(s.slug), p.id]);
      currentSlug = s.slug;
      rootAssigned++;
    }

    // 2) Refina para uma subcategoria DENTRO da raiz atual (se houver subcategorias).
    const children = childrenByParent.get(currentSlug);
    if (children && children.length) {
      const sub = nearestFrom(text, subVectors, children, SUB_THRESHOLD);
      if (sub.slug) {
        await pool.query("UPDATE product SET category_id = ? WHERE id = ?", [idBySlug.get(sub.slug), p.id]);
        refined++;
        console.log(`${p.canonical_name} -> ${sub.slug} (dist ${sub.distance.toFixed(3)})`);
      }
    }
  }

  console.log(`\nRaiz atribuída: ${rootAssigned} · Refinados em subcategoria: ${refined}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
