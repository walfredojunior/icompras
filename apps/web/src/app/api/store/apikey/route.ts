import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentStore, generateApiKey } from "@/lib/storeauth";

export async function POST() {
  const store = await getCurrentStore();
  if (!store) {
    return NextResponse.json({ error: "Faça login na loja." }, { status: 401 });
  }
  const { key, prefix, hash } = generateApiKey();
  // Revoga chaves anteriores e cria uma nova (mostrada só agora).
  await pool.query("UPDATE api_key SET revoked = 1 WHERE store_id = ?", [store.id]);
  await pool.query(
    "INSERT INTO api_key (store_id, key_prefix, key_hash, label) VALUES (?, ?, ?, 'painel')",
    [store.id, prefix, hash],
  );
  return NextResponse.json({ key });
}
