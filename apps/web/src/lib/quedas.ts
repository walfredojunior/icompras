import { pool } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Queda {
  slug: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  antes: number; // menor preço do produto no início da janela, em dólar
  agora: number; // menor preço de hoje, em dólar
  quedaPct: number;
  lojas: number;
}

// Janelas oferecidas na página. 7 dias é o padrão: um produto que baixou há
// 29 dias não é novidade — e provavelmente já subiu de novo.
export const JANELAS = [1, 7, 30] as const;
export type Janela = (typeof JANELAS)[number];

// Produtos cujo MENOR preço caiu dentro da janela.
//
// A comparação é sempre com o menor preço do produto, nunca com a oferta de uma
// loja isolada: se a loja mais cara baixou 20% e continua sendo a mais cara,
// isso não interessa a ninguém.
//
// O ponto de referência é o preço do PRIMEIRO dia da janela, e não o maior
// preço do período. É mais honesto: dá para dizer "há 7 dias custava X" sem
// escolher a foto mais favorável.
//
// ⚠ A CONTA NÃO MORA MAIS AQUI (05/08/2026). Ela percorria uma semana de
// `product_price_daily` (607 mil linhas) com função de janela e levava **1,58
// segundo** — a cada visita à página /quedas, à home e a qualquer listagem com
// o selo de queda. Como o resultado só muda uma vez por dia, quem calcula agora
// é o coletor (`atualizarQuedas` em crawl.ts), e aqui só se lê o pronto.
// Tudo em dólar: comparar em guarani faria o preço "cair" sozinho quando o
// câmbio mexesse.
export async function getQuedas(
  dias: Janela,
  limite = 60,
  categoriaSlug?: string,
): Promise<Queda[]> {
  const params: any[] = [dias];
  const filtroCategoria = categoriaSlug ? `AND (c.slug = ? OR pai.slug = ?)` : "";
  if (categoriaSlug) params.push(categoriaSlug, categoriaSlug);
  params.push(limite);

  return pool.query(
    `SELECT p.slug, p.canonical_name AS name, p.brand, p.primary_image_url AS image_url,
            CAST(d.antes AS DOUBLE) AS antes, CAST(d.agora AS DOUBLE) AS agora,
            d.pct AS quedaPct, d.offers AS lojas
       FROM product_price_drop d
       JOIN product p ON p.id = d.product_id
       LEFT JOIN category c ON c.id = p.category_id
       LEFT JOIN category pai ON pai.id = c.parent_id
      WHERE d.janela = ?
        ${filtroCategoria}
      ORDER BY d.pct DESC
      LIMIT ?`,
    params,
  );
}

// Quantas quedas existem em cada janela — alimenta os números das abas.
export async function contarQuedas(): Promise<Record<Janela, number>> {
  const saida = {} as Record<Janela, number>;
  const rows = await pool.query(
    "SELECT janela, COUNT(*) n FROM product_price_drop GROUP BY janela",
  );
  for (const dias of JANELAS) saida[dias] = 0;
  for (const r of rows) {
    const j = Number(r.janela) as Janela;
    if (JANELAS.includes(j)) saida[j] = Number(r.n);
  }
  return saida;
}

// Mapa slug -> % de queda nos últimos 7 dias, para o selo "−18%" nos cartões
// das listagens. Uma consulta só para a página inteira, em vez de uma por card.
export async function quedasPorSlug(slugs: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (!slugs.length) return mapa;
  const rows = await pool.query(
    `SELECT p.slug, d.pct
       FROM product_price_drop d JOIN product p ON p.id = d.product_id
      WHERE d.janela = 7 AND p.slug IN (${slugs.map(() => "?").join(",")})`,
    slugs,
  );
  for (const r of rows) mapa.set(r.slug, Number(r.pct));
  return mapa;
}
