import type { MetadataRoute } from "next";
import { pool } from "@/lib/db";
import { SITE_URL, PRODUTOS_POR_MAPA } from "@/lib/seo";

/* eslint-disable @typescript-eslint/no-explicit-any */

// robots.txt — o primeiro arquivo que um buscador procura ao chegar.
//
// Até 02/08/2026 o site não tinha nenhum: o endereço devolvia erro 404. Não é
// fatal (o Google indexa mesmo sem), mas é aqui que se aponta o mapa do site,
// e sem o mapa ele teria que descobrir 41 mil páginas de produto clicando link
// por link a partir da home — o que leva meses.
//
// Gerado, e não fixo, porque a lista de mapas cresce junto com o catálogo.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  let pedacos = 1;
  try {
    const [r]: any = await pool.query("SELECT COUNT(*) n FROM product");
    pedacos = Math.max(1, Math.ceil(Number(r.n) / PRODUTOS_POR_MAPA));
  } catch {
    /* banco fora do ar: entrega ao menos o mapa principal */
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Páginas de conta e de gestão: não têm o que indexar e algumas
          // exigem senha. Deixá-las de fora poupa rastreamento para o que
          // interessa, que são os produtos.
          "/api/",
          "/ir/",
          "/*/admin",
          "/*/painel",
          "/*/entrar",
          "/*/cadastro",
          "/*/alertas",
          "/*/favoritos",
          "/*/pagar",
        ],
      },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      ...Array.from({ length: pedacos }, (_, i) => `${SITE_URL}/produto/sitemap/${i}.xml`),
    ],
    host: SITE_URL,
  };
}
