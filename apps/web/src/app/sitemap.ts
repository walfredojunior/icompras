import type { MetadataRoute } from "next";
import { pool } from "@/lib/db";
import { comIdiomas, SITE_URL } from "@/lib/seo";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mapa principal: home, categorias, lojas e as páginas fixas.
//
// Os produtos ficam em arquivos separados (app/produto/sitemap.ts) porque são
// dezenas de milhares e o Google limita 50 mil endereços por arquivo.
//
// Cada endereço vai com as três versões de idioma declaradas como
// "alternates": assim o Google entende que /pt-BR/produto/x, /es/produto/x e
// /en/produto/x são a MESMA página em idiomas diferentes, e não três páginas
// concorrendo entre si — o que derrubaria a posição das três.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date();
  const itens: MetadataRoute.Sitemap = [
    { ...comIdiomas("/"), lastModified: agora, changeFrequency: "daily", priority: 1 },
    { ...comIdiomas("/quedas"), lastModified: agora, changeFrequency: "hourly", priority: 0.9 },
    { ...comIdiomas("/categorias"), lastModified: agora, changeFrequency: "weekly", priority: 0.7 },
    { ...comIdiomas("/lojas"), lastModified: agora, changeFrequency: "weekly", priority: 0.6 },
  ];

  try {
    // Só categorias com produto: mandar o Google a uma página vazia gasta o
    // rastreamento dele e ainda deixa impressão de site oco.
    const cats: any[] = await pool.query(
      `SELECT c.slug FROM category c
        WHERE EXISTS (
          SELECT 1 FROM product p
           LEFT JOIN category sub ON sub.id = p.category_id
           WHERE p.category_id = c.id OR sub.parent_id = c.id)
        ORDER BY c.position`,
    );
    for (const c of cats) {
      itens.push({
        ...comIdiomas(`/categorias/${c.slug}`),
        lastModified: agora,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    const lojas: any[] = await pool.query(
      `SELECT s.slug FROM store s
        WHERE s.status = 'active'
          AND EXISTS (SELECT 1 FROM product_store ps WHERE ps.store_id = s.id)
        ORDER BY s.name`,
    );
    for (const l of lojas) {
      itens.push({
        ...comIdiomas(`/loja/${l.slug}`),
        lastModified: agora,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  } catch {
    /* banco fora do ar: entrega ao menos as páginas fixas */
  }

  return itens;
}

export { SITE_URL };
