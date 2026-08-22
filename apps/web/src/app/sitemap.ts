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

  // ⚠ "ONDE COMER" SÓ ENTRA NO MAPA SE TIVER RESTAURANTE (22/08/2026).
  //
  // Mandar o Google a uma página vazia gasta o orçamento de rastreamento — que
  // aqui é escasso: ele já leva ~100 dias para dar uma volta no catálogo. E
  // página vazia indexada é pior que página não indexada: ela fica no índice
  // como "sem conteúdo" e demora a melhorar de conceito depois.
  //
  // 💡 Esta página é a RAZÃO de o guia existir: "onde comer em Ciudad del Este"
  // é busca que as pessoas fazem antes de viajar, e ela traz visitante NOVO — o
  // bloco na home só aparece para quem já entrou.
  try {
    const [r]: any = await pool.query(
      `SELECT COUNT(*) AS n FROM restaurante
        WHERE active = 1
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at >= NOW())`,
    );
    if (Number(r?.n ?? 0) > 0) {
      itens.push({
        ...comIdiomas("/onde-comer"),
        lastModified: agora,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // Sem o guia no mapa o site continua normal — não vale derrubar o sitemap
    // inteiro por causa dele.
  }

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
