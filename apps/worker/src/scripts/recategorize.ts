import "../env.js";
import { pool } from "@icompras/db";
import { classifyRoot } from "../classify.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Re-categoriza os produtos existentes pela RAIZ correta (baseado no nome).
// Só move quem está na raiz errada; quem já está certo (ou não classificável) fica.
async function main(): Promise<void> {
  const cats: Array<{ id: number; slug: string; parent_id: number | null }> = await pool.query(
    "SELECT id, slug, parent_id FROM category",
  );
  const rootIdBySlug = new Map<string, number>();
  const byId = new Map<number, { slug: string; parent_id: number | null }>();
  for (const c of cats) {
    byId.set(Number(c.id), { slug: c.slug, parent_id: c.parent_id != null ? Number(c.parent_id) : null });
    if (!c.parent_id) rootIdBySlug.set(c.slug, Number(c.id));
  }

  function rootOf(categoryId: number | null): string | null {
    if (!categoryId) return null;
    const c = byId.get(Number(categoryId));
    if (!c) return null;
    return c.parent_id ? byId.get(c.parent_id)?.slug ?? null : c.slug;
  }

  const prods: Array<{ id: number; canonical_name: string; category_id: number | null }> = await pool.query(
    "SELECT id, canonical_name, category_id FROM product",
  );

  let moved = 0;
  let unmatched = 0;
  const perRoot: Record<string, number> = {};

  for (const p of prods) {
    const root = classifyRoot(p.canonical_name);
    if (!root) {
      unmatched++;
      continue;
    }
    const targetId = rootIdBySlug.get(root);
    if (!targetId) continue;
    const curRoot = rootOf(p.category_id);
    if (curRoot !== root) {
      await pool.query("UPDATE product SET category_id = ? WHERE id = ?", [targetId, p.id]);
      moved++;
      perRoot[root] = (perRoot[root] ?? 0) + 1;
    }
  }

  console.log(`Re-categorização concluída: ${moved} produto(s) movido(s), ${unmatched} sem regra (mantidos).`);
  console.log("Movidos por raiz:", JSON.stringify(perRoot));
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
