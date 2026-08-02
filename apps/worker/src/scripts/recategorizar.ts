// Corrige a categoria dos produtos JÁ coletados.
//
// A fonte nomeia os produtos como "Tipo Marca Modelo", e o tipo é o nome da
// categoria dela — então o nome do produto já diz, sem ambiguidade, onde ele
// deve ficar. Antes a subcategoria era adivinhada por semelhança de letras, o
// que jogava "Robô de Limpeza" em Cozinha e "Tablet" em Televisores.
//
//   npm run recategorizar -w @icompras/worker
//   npm run recategorizar -w @icompras/worker -- --simular   (só mostra, não grava)
import "../env.js";
import { pool } from "@icompras/db";
import { categoryFromProductSlug } from "../taxonomy.js";

async function main(): Promise<void> {
  const simular = process.argv.includes("--simular");

  const cats: Array<{ id: number; slug: string; parent_id: number | null }> = await pool.query(
    "SELECT id, slug, parent_id FROM category",
  );
  const idBySlug = new Map(cats.map((c) => [c.slug, Number(c.id)]));
  const slugs = new Set(cats.map((c) => c.slug));
  console.log(`${slugs.size} categorias conhecidas.`);

  const produtos: Array<{ id: number; slug: string }> = await pool.query("SELECT id, slug FROM product");
  console.log(`${produtos.length} produtos a conferir.\n`);

  // Agrupa por categoria de destino para atualizar em lote.
  const porCategoria = new Map<string, number[]>();
  const semCategoria: string[] = [];
  for (const p of produtos) {
    const cat = categoryFromProductSlug(p.slug, slugs);
    if (!cat) {
      semCategoria.push(p.slug);
      continue;
    }
    const lista = porCategoria.get(cat);
    if (lista) lista.push(Number(p.id));
    else porCategoria.set(cat, [Number(p.id)]);
  }

  const ordenado = [...porCategoria.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [cat, ids] of ordenado) console.log(`  ${cat.padEnd(34)} ${ids.length}`);
  console.log(`\nSem categoria reconhecida: ${semCategoria.length}`);
  for (const s of semCategoria.slice(0, 15)) console.log(`    ${s.slice(0, 70)}`);

  if (simular) {
    console.log("\n(simulação — nada foi gravado)");
    await pool.end();
    return;
  }

  let total = 0;
  for (const [cat, ids] of ordenado) {
    const catId = idBySlug.get(cat);
    if (!catId) continue;
    // Em blocos, para não montar uma consulta gigante.
    for (let i = 0; i < ids.length; i += 500) {
      const bloco = ids.slice(i, i + 500);
      await pool.query(
        `UPDATE product SET category_id = ?, source_category = ? WHERE id IN (${bloco.map(() => "?").join(",")})`,
        [catId, cat, ...bloco],
      );
      total += bloco.length;
    }
  }
  console.log(`\n${total} produto(s) recategorizados.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
