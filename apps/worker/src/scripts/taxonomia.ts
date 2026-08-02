// Copia a árvore de categorias do site de origem para o nosso banco.
//   npm run taxonomia -w @icompras/worker
import "../env.js";
import { pool } from "@icompras/db";
import { fetchSourceTree, syncTaxonomy, cleanupTaxonomy } from "../taxonomy.js";

async function main(): Promise<void> {
  const groups = await fetchSourceTree();
  console.log(`Fonte: ${groups.length} grupos, ${groups.reduce((n, g) => n + g.subs.length, 0)} subcategorias.`);
  for (const g of groups) console.log(`  ${g.name} (${g.subs.length})`);

  const { roots, subs } = await syncTaxonomy(groups);
  console.log(`\nGravado: ${roots} grupos + ${subs} subcategorias.`);

  // --limpar remove categorias vazias que não existem mais na fonte.
  if (process.argv.includes("--limpar")) {
    const removidas = await cleanupTaxonomy(groups);
    console.log(`Removidas ${removidas.length} categoria(s) vazia(s) fora da árvore da fonte.`);
    if (removidas.length) console.log(`  ${removidas.slice(0, 40).join(", ")}`);
  }

  const [tot] = await pool.query("SELECT COUNT(*) n FROM category");
  console.log(`Total de categorias no banco: ${tot.n}`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
