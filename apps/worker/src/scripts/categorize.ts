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

  // ⚠⚠ SÓ OS QUE PRECISAM, E EM LOTES. ⚠⚠
  //
  // A versão anterior fazia `SELECT ... FROM product` sem filtro nem limite:
  // carregava o catálogo INTEIRO na memória (321.803 produtos em 15/08/2026) e
  // depois disparava um UPDATE por produto. Serviu quando o catálogo tinha
  // alguns milhares; hoje seria uma consulta de centenas de MB e mais de 300
  // mil idas ao banco, no mesmo banco que atende o site.
  //
  // 💡 O QUE TORNOU ISSO URGENTE: em 13-15/08 a recuperação pelo mapa da fonte
  // trouxe ~107 mil produtos com `source_category = "mapa"` — que é o nome da
  // UNIDADE DE TRABALHO, não uma categoria. Unidade de mapa mistura todos os
  // assuntos, então não há categoria a herdar, e 80% do que entrou ficou sem
  // classificação. Sem categoria o produto some dos filtros, dos blocos da home
  // e piora os "produtos relacionados", que buscam semelhantes DENTRO da
  // categoria.
  //
  // `SOMENTE_SEM_CATEGORIA` é o padrão porque é o caso real: reclassificar quem
  // já tem categoria é trabalho para reverter decisão humana feita no admin.
  const SO_SEM_CATEGORIA = !process.argv.includes("--tudo");
  const LOTE = Number(process.env.CATEGORIZE_LOTE ?? 2000);
  const TETO = Number(process.env.CATEGORIZE_MAX ?? 0); // 0 = sem teto

  const [{ total }] = await pool.query(
    `SELECT COUNT(*) total FROM product ${SO_SEM_CATEGORIA ? "WHERE category_id IS NULL" : ""}`,
  );
  console.log(`${Number(total).toLocaleString("pt-BR")} produto(s) para classificar${SO_SEM_CATEGORIA ? " (sem categoria)" : " (TODOS)"}`);

  let ultimoId = 0;
  let processados = 0;
  let rootAssigned = 0;
  let refined = 0;

  // Paginação por id, não por OFFSET: com OFFSET o banco relê tudo que já
  // passou a cada lote, e o custo cresce a cada volta.
  for (;;) {
    const products = await pool.query(
      `SELECT id, brand, canonical_name, category_id FROM product
        WHERE id > ? ${SO_SEM_CATEGORIA ? "AND category_id IS NULL" : ""}
        ORDER BY id LIMIT ?`,
      [ultimoId, LOTE],
    );
    if (!products.length) break;
    ultimoId = Number(products[products.length - 1].id);
    processados += products.length;
    await classificarLote(products);
    console.log(`  ${processados.toLocaleString("pt-BR")} / ${Number(total).toLocaleString("pt-BR")} · raiz ${rootAssigned} · refinados ${refined}`);
    // Respiro entre lotes: o banco também atende o site enquanto isto roda.
    await new Promise((r) => setTimeout(r, 200));
    if (TETO && processados >= TETO) { console.log(`  teto de ${TETO} atingido, parando`); break; }
  }

  async function classificarLote(products: any[]) {
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

  }
  console.log(`\nRaiz atribuída: ${rootAssigned} · Refinados em subcategoria: ${refined}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
