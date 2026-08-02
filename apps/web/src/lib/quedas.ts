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

// Abaixo disso não é queda, é ruído de centavo.
const QUEDA_MINIMA = 0.03;

// Produtos cujo MENOR preço caiu dentro da janela.
//
// A comparação é sempre com o menor preço do produto, nunca com a oferta de uma
// loja isolada: se a loja mais cara baixou 20% e continua sendo a mais cara,
// isso não interessa a ninguém.
//
// O ponto de referência é o preço do PRIMEIRO dia da janela (FIRST_VALUE
// ordenando por data), e não o maior preço do período. É mais honesto: dá para
// dizer "há 7 dias custava X" sem escolher a foto mais favorável.
//
// Tudo em dólar, que é como a fonte publica. Comparar em guarani faria o preço
// "cair" sozinho toda vez que o câmbio mexesse.
export async function getQuedas(
  dias: Janela,
  limite = 60,
  categoriaSlug?: string,
): Promise<Queda[]> {
  const filtroCategoria = categoriaSlug
    ? `AND (c.slug = ? OR pai.slug = ?)`
    : "";
  const params: any[] = [dias];
  if (categoriaSlug) params.push(categoriaSlug, categoriaSlug);
  params.push(QUEDA_MINIMA, limite);

  return pool.query(
    `WITH janela AS (
       SELECT product_id, day, min_usd, offers,
              FIRST_VALUE(min_usd) OVER (PARTITION BY product_id ORDER BY day) AS antes
         FROM product_price_daily
        WHERE day >= CURDATE() - INTERVAL ? DAY
     )
     SELECT p.slug, p.canonical_name AS name, p.brand, p.primary_image_url AS image_url,
            CAST(j.antes AS DOUBLE) AS antes, CAST(j.min_usd AS DOUBLE) AS agora,
            ROUND((j.antes - j.min_usd) / j.antes * 100) AS quedaPct,
            j.offers AS lojas
       FROM janela j
       JOIN product p ON p.id = j.product_id
       LEFT JOIN category c ON c.id = p.category_id
       LEFT JOIN category pai ON pai.id = c.parent_id
      WHERE j.day = CURDATE()
        AND j.antes > j.min_usd
        ${filtroCategoria}
        AND (j.antes - j.min_usd) / j.antes >= ?
      ORDER BY (j.antes - j.min_usd) / j.antes DESC
      LIMIT ?`,
    params,
  );
}

// Quantas quedas existem em cada janela — alimenta os números das abas.
export async function contarQuedas(): Promise<Record<Janela, number>> {
  const saida = {} as Record<Janela, number>;
  for (const dias of JANELAS) {
    const [r] = await pool.query(
      `WITH janela AS (
         SELECT product_id, day, min_usd,
                FIRST_VALUE(min_usd) OVER (PARTITION BY product_id ORDER BY day) AS antes
           FROM product_price_daily
          WHERE day >= CURDATE() - INTERVAL ? DAY
       )
       SELECT COUNT(*) n FROM janela j
        WHERE j.day = CURDATE() AND j.antes > j.min_usd
          AND (j.antes - j.min_usd) / j.antes >= ?`,
      [dias, QUEDA_MINIMA],
    );
    saida[dias] = Number(r?.n ?? 0);
  }
  return saida;
}

// Mapa slug -> % de queda nos últimos 7 dias, para o selo "−18%" nos cartões
// das listagens. Uma consulta só para a página inteira, em vez de uma por card.
export async function quedasPorSlug(slugs: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (!slugs.length) return mapa;
  const rows = await pool.query(
    `WITH janela AS (
       SELECT product_id, day, min_usd,
              FIRST_VALUE(min_usd) OVER (PARTITION BY product_id ORDER BY day) AS antes
         FROM product_price_daily
        WHERE day >= CURDATE() - INTERVAL 7 DAY
     )
     SELECT p.slug, ROUND((j.antes - j.min_usd) / j.antes * 100) AS pct
       FROM janela j JOIN product p ON p.id = j.product_id
      WHERE j.day = CURDATE() AND j.antes > j.min_usd
        AND (j.antes - j.min_usd) / j.antes >= ?
        AND p.slug IN (${slugs.map(() => "?").join(",")})`,
    [QUEDA_MINIMA, ...slugs],
  );
  for (const r of rows) mapa.set(r.slug, Number(r.pct));
  return mapa;
}
