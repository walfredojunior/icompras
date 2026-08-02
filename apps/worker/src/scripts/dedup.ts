import "../env.js";
import { pool } from "@icompras/db";
import type { PoolConnection } from "mariadb";

// Distância de cosseno máxima para considerar dois produtos "o mesmo".
const THRESHOLD = Number(process.env.DEDUP_THRESHOLD ?? 0.35);

async function mergeProducts(conn: PoolConnection, canonical: number, dup: number): Promise<void> {
  const dVariants = await conn.query("SELECT id, signature FROM product_variant WHERE product_id = ?", [dup]);

  for (const dv of dVariants) {
    const existing = await conn.query(
      "SELECT id FROM product_variant WHERE product_id = ? AND signature = ? LIMIT 1",
      [canonical, dv.signature],
    );
    if (existing.length) {
      // O canônico já tem essa variante: move as ofertas e descarta a duplicada.
      const cv = Number(existing[0].id);
      await conn.query("UPDATE offer SET variant_id = ? WHERE variant_id = ?", [cv, dv.id]);
      await conn.query("DELETE FROM variant_attribute WHERE variant_id = ?", [dv.id]);
      await conn.query("DELETE FROM product_variant WHERE id = ?", [dv.id]);
    } else {
      // Variante nova para o canônico: apenas reatribui.
      await conn.query("UPDATE product_variant SET product_id = ? WHERE id = ?", [canonical, dv.id]);
    }
  }

  // Imagem: canônico herda a do duplicado se ainda não tiver.
  const d = await conn.query("SELECT primary_image_url FROM product WHERE id = ?", [dup]);
  await conn.query(
    "UPDATE product SET primary_image_url = COALESCE(primary_image_url, ?) WHERE id = ?",
    [d[0]?.primary_image_url ?? null, canonical],
  );

  // Remove o produto duplicado (embedding cai por cascata).
  await conn.query("DELETE FROM product WHERE id = ?", [dup]);
}

async function main(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    const pairs = await conn.query(
      `SELECT e1.product_id AS a, e2.product_id AS b,
              VEC_DISTANCE_COSINE(e1.embedding, e2.embedding) AS dist
       FROM product_embedding e1
       JOIN product_embedding e2 ON e2.product_id > e1.product_id
       JOIN product p1 ON p1.id = e1.product_id
       JOIN product p2 ON p2.id = e2.product_id
       WHERE p1.brand <=> p2.brand
       HAVING dist < ?
       ORDER BY dist`,
      [THRESHOLD],
    );

    const merged = new Set<number>();
    let count = 0;
    for (const pr of pairs) {
      const canonical = Math.min(Number(pr.a), Number(pr.b));
      const dup = Math.max(Number(pr.a), Number(pr.b));
      if (merged.has(dup) || merged.has(canonical)) continue;
      console.log(`Mesclando produto ${dup} -> ${canonical} (distância ${Number(pr.dist).toFixed(3)})`);
      await mergeProducts(conn, canonical, dup);
      merged.add(dup);
      count++;
    }

    console.log(count ? `${count} produto(s) duplicado(s) mesclado(s).` : "Nenhum duplicado acima do limiar.");
  } finally {
    conn.release();
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
