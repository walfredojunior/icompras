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

/**
 * ORDENS OFERECIDAS NA PÁGINA.
 *
 * O padrão era "maior desconto (%)" e o topo virava bugiganga: medido em
 * 07/08/2026, os três primeiros eram um adaptador USB de US$ 10 → 3, uma
 * tomada de 8 → 3 e uma capa de celular de 1 → 0,50. Desconto de 70% que
 * economiza sete dólares ocupava o lugar de destaque da página.
 *
 * O dono pediu o preço como padrão: "o de maior valor que tenha desconto,
 * fica mais interessante". Faz sentido — quem entra em "baixaram de preço"
 * está atrás de celular, câmera, TV; não de adaptador.
 */
export const ORDENS = {
  preco: "d.agora DESC",
  economia: "(d.antes - d.agora) DESC",
  desconto: "d.pct DESC",
  barato: "d.agora ASC",
} as const;
export type Ordem = keyof typeof ORDENS;
export const ORDEM_PADRAO: Ordem = "preco";

/**
 * Economia mínima para a queda aparecer.
 *
 * A capa de celular que "baixou 50%" foi de US$ 1,00 para US$ 0,50. Em
 * qualquer ordem isso é ruído: não é notícia para ninguém e ocupa espaço.
 * Dois dólares é baixo o bastante para não esconder promoção de verdade.
 */
const ECONOMIA_MINIMA = 2;
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
  ordem: Ordem = ORDEM_PADRAO,
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
        AND (d.antes - d.agora) >= ${ECONOMIA_MINIMA}
        ${filtroCategoria}
      -- Vem de ORDENS, nunca do endereço: interpolar texto do visitante
      -- num ORDER BY é convite a injeção. A página traduz o que veio na
      -- URL para uma dessas chaves antes de chegar aqui.
      ORDER BY ${ORDENS[ordem] ?? ORDENS[ORDEM_PADRAO]}
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
