import "../env.js";
import { pool } from "@icompras/db";
import { getEmbeddingProvider } from "@icompras/core";

async function main(): Promise<void> {
  const provider = getEmbeddingProvider();
  const rows = await pool.query("SELECT id, brand, canonical_name FROM product");

  for (const r of rows) {
    const text = `${r.brand ?? ""} ${r.canonical_name}`.trim();
    const [vec] = await provider.embed([text]);
    const json = JSON.stringify(vec);
    await pool.query(
      `INSERT INTO product_embedding (product_id, embedding, model)
       VALUES (?, VEC_FromText(?), ?)
       ON DUPLICATE KEY UPDATE embedding = VALUES(embedding), model = VALUES(model)`,
      [r.id, json, provider.name],
    );
  }

  console.log(`Embeddings gerados para ${rows.length} produto(s) (provedor: ${provider.name}).`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
