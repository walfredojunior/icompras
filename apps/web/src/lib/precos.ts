import { pool } from "./db";

// A TABELA DE PREÇOS da divulgação (21/08/2026).
//
// ⚠ POR QUE EXISTE. O preço era digitado à mão em cada venda. Ele pediu "poder
// fazer uma lista de preço e na hora de definir o preço da divulgação ter uma
// lista ali". Sem isso, a mesma categoria sai por valores diferentes conforme
// o dia, e não há resposta rápida para "quanto custa o banner de perfume?".
//
// 💡 Tudo em DÓLAR — ele confirmou que cobra em dólar, e o catálogo já é USD.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Faixa = "grande" | "media" | "pequena";
export type Slot = "topo" | "meio" | "fim";
export type Duracao = "mensal" | "trimestral" | "semestral" | "avulso";

export interface LinhaDePreco {
  id: number;
  servico: string;
  slot: Slot | null;
  faixa: Faixa | null;
  descricao: string;
  currency: string;
  valor_mensal: number;
  valor_trimestral: number | null;
  valor_semestral: number | null;
  ativo: number;
}

/**
 * Em que faixa de preço uma categoria está, pelo tamanho dela.
 *
 * ⚠ OS CORTES VIERAM DO CATÁLOGO REAL, medido em 21/08/2026 — não são chute:
 *   3.000+  →  22 categorias   (perfume, cosmético, diversos, calçados…)
 *   500+    → 118 categorias
 *   < 500   → 378 categorias
 *
 * 💡 Preço por faixa, e não por categoria: manter 519 preços à mão seria
 * impossível. Mas preço único também não serve — perfume tem 30.603 produtos
 * e abajur tem algumas dezenas.
 */
export function faixaPorTamanho(produtos: number): Faixa {
  if (produtos >= 3000) return "grande";
  if (produtos >= 500) return "media";
  return "pequena";
}

export const ROTULO_FAIXA: Record<Faixa, string> = {
  grande: "categoria grande",
  media: "categoria média",
  pequena: "categoria pequena",
};

export const ROTULO_SLOT: Record<Slot, string> = {
  topo: "topo da lista",
  meio: "meio da lista",
  fim: "fim da lista",
};

/** A tabela inteira, para a tela de preços e para as caixas de seleção. */
export async function tabelaDePrecos(): Promise<LinhaDePreco[]> {
  const linhas = await pool.query(
    `SELECT * FROM preco_tabela
      ORDER BY FIELD(servico,'banner_categoria','banner_home','destaque','outro'),
               FIELD(slot,'topo','meio','fim'),
               FIELD(faixa,'grande','media','pequena')`,
  );
  return linhas.map(normalizar);
}

function normalizar(l: any): LinhaDePreco {
  return {
    ...l,
    id: Number(l.id),
    valor_mensal: Number(l.valor_mensal),
    valor_trimestral: l.valor_trimestral != null ? Number(l.valor_trimestral) : null,
    valor_semestral: l.valor_semestral != null ? Number(l.valor_semestral) : null,
    ativo: Number(l.ativo),
  };
}

/** O valor de uma linha na duração escolhida. Sem trimestral/semestral, cai no mensal. */
export function valorDe(linha: LinhaDePreco, duracao: Duracao): number {
  if (duracao === "trimestral" && linha.valor_trimestral != null) return linha.valor_trimestral;
  if (duracao === "semestral" && linha.valor_semestral != null) return linha.valor_semestral;
  return linha.valor_mensal;
}

/**
 * Quantos produtos cada categoria tem — é o que decide a faixa.
 *
 * 💡 Uma consulta agrupada só, e não uma por categoria. A tela de preços e a de
 * banners usam o mesmo dado.
 */
export async function produtosPorCategoria(): Promise<Record<string, number>> {
  const linhas = await pool.query(
    `SELECT c.slug, COUNT(p.id) AS n
       FROM category c LEFT JOIN product p ON p.category_id = c.id
      GROUP BY c.slug`,
  );
  const mapa: Record<string, number> = {};
  for (const l of linhas) mapa[l.slug] = Number(l.n);
  return mapa;
}

/**
 * O preço sugerido para vender um espaço de categoria.
 *
 * Devolve nulo quando não há linha cadastrada para aquela combinação — a tela
 * então deixa o valor em branco para ser digitado, em vez de inventar um preço.
 */
export async function precoSugerido(
  categorySlug: string,
  slot: Slot,
  duracao: Duracao = "mensal",
): Promise<{ linha: LinhaDePreco; valor: number; faixa: Faixa } | null> {
  const porCategoria = await produtosPorCategoria();
  const faixa = faixaPorTamanho(porCategoria[categorySlug] ?? 0);
  const linhas = await pool.query(
    `SELECT * FROM preco_tabela
      WHERE servico = 'banner_categoria' AND slot = ? AND faixa = ? AND ativo = 1
      LIMIT 1`,
    [slot, faixa],
  );
  if (!linhas[0]) return null;
  const linha = normalizar(linhas[0]);
  return { linha, valor: valorDe(linha, duracao), faixa };
}
