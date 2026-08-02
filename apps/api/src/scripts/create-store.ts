import "../env.js";
import { pool } from "@icompras/db";
import { generateApiKey } from "@icompras/core";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "loja"
  );
}

async function main(): Promise<void> {
  const name = process.argv[2] ?? "Loja Teste";
  const slug = `${slugify(name)}-${Date.now().toString(36)}`;

  const res = (await pool.query(
    "INSERT INTO store (slug, name, status, source) VALUES (?, ?, 'active', 'api')",
    [slug, name],
  )) as { insertId: number };
  const storeId = Number(res.insertId);

  const { key, prefix, hash } = generateApiKey();
  await pool.query(
    "INSERT INTO api_key (store_id, key_prefix, key_hash, label) VALUES (?, ?, ?, 'default')",
    [storeId, prefix, hash],
  );

  console.log("Loja criada:");
  console.log("  id:   ", storeId);
  console.log("  nome: ", name);
  console.log("  slug: ", slug);
  console.log("");
  console.log("CHAVE DE API (guarde — só aparece agora):");
  console.log("  " + key);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
