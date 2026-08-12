import type { MetadataRoute } from "next";
import { pool } from "@/lib/db";
import { comIdiomas, PRODUTOS_POR_MAPA } from "@/lib/seo";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mapa dos produtos, em pedaços de 10 mil.
//
// São 41 mil produtos hoje, indo para ~120 mil. O Google aceita no máximo 50
// mil endereços por arquivo; uso 10 mil para os arquivos serem gerados rápido
// e para ele reprocessar só o pedaço que mudou.
//
// Os endereços ficam em /produto/sitemap/0.xml, /1.xml… e são listados no
// robots.txt, que é como o Google descobre todos.
export const dynamic = "force-dynamic";

// SÓ ENTRA NO MAPA QUEM TEM OFERTA NO AR.
//
// A página de produto passou a devolver 404 quando não há nenhuma oferta
// visível (ver [locale]/produto/[slug]/page.tsx) — por privacidade do cliente,
// no caso do que ele ainda não liberou, e por não valer nada, no caso dos
// 3.028 que o coletor deixou sem oferta.
//
// ⚠ Sem este filtro, o mapa mandaria o Google a três mil endereços que
// respondem 404. Mapa de site cheio de link quebrado é justamente o tipo de
// sinal que faz o buscador rastrear menos o resto.
const COM_OFERTA = `EXISTS (
  SELECT 1 FROM product_variant v JOIN offer o ON o.variant_id = v.id
   WHERE v.product_id = p.id AND o.in_stock = 1
)`;

export async function generateSitemaps() {
  try {
    const [r]: any = await pool.query(`SELECT COUNT(*) n FROM product p WHERE ${COM_OFERTA}`);
    const pedacos = Math.max(1, Math.ceil(Number(r.n) / PRODUTOS_POR_MAPA));
    return Array.from({ length: pedacos }, (_, id) => ({ id }));
  } catch {
    return [{ id: 0 }];
  }
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const pedaco = Number(await id) || 0;

  // Ordena por id para o fatiamento ser estável: sem ordem definida, o mesmo
  // produto poderia aparecer em dois pedaços ou em nenhum a cada geração.
  const rows: any[] = await pool.query(
    `SELECT p.slug, p.updated_at
       FROM product p
      WHERE ${COM_OFERTA}
      ORDER BY p.id
      LIMIT ? OFFSET ?`,
    [PRODUTOS_POR_MAPA, pedaco * PRODUTOS_POR_MAPA],
  );

  return rows.map((p) => ({
    ...comIdiomas(`/produto/${p.slug}`),
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    // Preço muda com frequência, e é o preço que faz a página valer.
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));
}
