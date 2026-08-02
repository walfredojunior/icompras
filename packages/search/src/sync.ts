import "./env.js";
import { pool } from "@icompras/db";
import { syncProducts } from "./index.js";

async function main(): Promise<void> {
  const n = await syncProducts();
  console.log(`Indexados ${n} produto(s) no Meilisearch.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
