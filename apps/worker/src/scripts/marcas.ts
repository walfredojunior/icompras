// Preenche a marca dos produtos a partir do nome.
//   npm run marcas -w @icompras/worker
//   npm run marcas -w @icompras/worker -- --simular
import "../env.js";
import { pool } from "@icompras/db";
import { buildBrandIndex, brandFromName } from "../brands.js";

async function main(): Promise<void> {
  const simular = process.argv.includes("--simular");

  const produtos: Array<{ id: number; name: string; category: string | null }> = await pool.query(
    `SELECT p.id, p.canonical_name AS name, c.slug AS category
       FROM product p LEFT JOIN category c ON c.id = p.category_id`,
  );
  console.log(`${produtos.length} produtos.`);

  const idx = buildBrandIndex(produtos);
  const porMarca = new Map<string, number[]>();
  let sem = 0;
  for (const p of produtos) {
    const marca = brandFromName(p.name, p.category, idx);
    if (!marca) {
      sem++;
      continue;
    }
    const l = porMarca.get(marca);
    if (l) l.push(Number(p.id));
    else porMarca.set(marca, [Number(p.id)]);
  }

  const ordenado = [...porMarca.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`\n${porMarca.size} marcas distintas · ${sem} produtos sem marca reconhecida.`);
  console.log("\nAs 25 maiores:");
  for (const [m, ids] of ordenado.slice(0, 25)) console.log(`  ${m.padEnd(28)} ${ids.length}`);

  if (simular) {
    console.log("\n(simulação — nada foi gravado)");
    await pool.end();
    return;
  }

  let total = 0;
  for (const [marca, ids] of ordenado) {
    for (let i = 0; i < ids.length; i += 500) {
      const bloco = ids.slice(i, i + 500);
      await pool.query(
        `UPDATE product SET brand = ? WHERE id IN (${bloco.map(() => "?").join(",")})`,
        [marca, ...bloco],
      );
      total += bloco.length;
    }
  }
  console.log(`\n${total} produto(s) com marca preenchida.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
