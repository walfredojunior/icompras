import { pool } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Os produtos de uma loja, para ela mesma revisar e liberar (migração 054).
//
// Pedido dele em 11/08/2026: cliente com sistema antigo manda a lista sem foto,
// e hoje isso entra direto no site. Com a análise ligada, o que chega fica
// retido até a loja completar e liberar.
//
// ⚠ O ESTADO SAI TODO DO `in_stock` + `gone_reason`, sem campo novo. Existem
// dez lugares no código que leem oferta e todos já filtram `in_stock = 1`;
// um portão paralelo precisaria ser lembrado nos dez, e esquecer um publicaria
// no site o que o cliente não liberou.

export type Aba = "faltando" | "prontos" | "no-ar" | "fora";

export interface ProdutoDaLoja {
  offerId: number;
  productId: number;
  nome: string;
  slug: string;
  preco: number | null;
  moeda: string;
  foto: string | null;
  descricao: string | null;
  ficha: Array<{ k: string; v: string }>;
  /** O que impede de liberar. Vazio = pronto. */
  falta: string[];
  estado: Aba;
  /** Outra loja também vende este produto — então ele é compartilhado. */
  compartilhado: boolean;
}

/** O que consideramos "produto completo". */
function oQueFalta(r: any): string[] {
  const f: string[] = [];
  if (!r.foto) f.push("foto");
  if (!r.descricao || String(r.descricao).trim().length < 20) f.push("descrição");
  let ficha: unknown[] = [];
  try {
    ficha = r.specs ? (typeof r.specs === "string" ? JSON.parse(r.specs) : r.specs) : [];
  } catch {
    ficha = [];
  }
  if (!Array.isArray(ficha) || ficha.length === 0) f.push("ficha técnica");
  return f;
}

function estadoDe(r: any, falta: string[]): Aba {
  if (r.gone_reason === "excluida") return "fora";
  if (Number(r.in_stock) === 1) return "no-ar";
  return falta.length ? "faltando" : "prontos";
}

function paraProduto(r: any): ProdutoDaLoja {
  const falta = oQueFalta(r);
  let ficha: Array<{ k: string; v: string }> = [];
  try {
    const p = r.specs ? (typeof r.specs === "string" ? JSON.parse(r.specs) : r.specs) : [];
    if (Array.isArray(p)) ficha = p;
  } catch {
    /* ficha inválida no banco não pode quebrar a tela */
  }
  return {
    offerId: Number(r.offer_id),
    productId: Number(r.product_id),
    nome: String(r.nome ?? ""),
    slug: String(r.slug ?? ""),
    preco: r.price == null ? null : Number(r.price),
    moeda: String(r.currency ?? "USD"),
    foto: r.foto ?? null,
    descricao: r.descricao ?? null,
    ficha,
    falta,
    estado: estadoDe(r, falta),
    compartilhado: Number(r.outras_lojas ?? 0) > 0,
  };
}

/**
 * A lista da loja, já classificada.
 *
 * Traz tudo de uma vez e separa em memória: uma loja tem centenas ou poucos
 * milhares de itens, não centenas de milhares. Quatro consultas separadas
 * (uma por aba) seriam quatro varreduras para o mesmo resultado — o erro que
 * eu cometi na tela de leads e que a deixou 30 segundos pendurada.
 */
export async function produtosDaLoja(storeId: number, busca = ""): Promise<ProdutoDaLoja[]> {
  const termo = busca.trim();
  const linhas = await pool
    .query(
      `SELECT o.id AS offer_id, o.in_stock, o.gone_reason, o.price, o.currency,
              p.id AS product_id, p.canonical_name AS nome, p.slug,
              p.primary_image_url AS foto, p.description AS descricao, p.specs,
              (SELECT COUNT(*) FROM offer o2
                WHERE o2.variant_id = o.variant_id AND o2.store_id <> o.store_id) AS outras_lojas
         FROM offer o
         JOIN product_variant v ON v.id = o.variant_id
         JOIN product p ON p.id = v.product_id
        WHERE o.store_id = ?
          ${termo ? "AND p.canonical_name LIKE ?" : ""}
        ORDER BY p.canonical_name
        LIMIT 2000`,
      termo ? [storeId, `%${termo}%`] : [storeId],
    )
    .catch(() => []);
  return linhas.map(paraProduto);
}

/**
 * Grava o que a loja preencheu.
 *
 * ⚠ SÓ MEXE NO PRODUTO SE ELE FOR SÓ DELA. Um produto pode ser vendido por
 * várias lojas — é assim que o comparador funciona. Deixar uma loja reescrever
 * o nome, a foto ou a ficha de um produto compartilhado seria dar a ela o
 * poder de mudar a página que as concorrentes também usam.
 *
 * Se for compartilhado, ela ainda pode PREENCHER o que está vazio (foto que
 * não existe, descrição que não existe) — isso só acrescenta, não sobrescreve
 * o trabalho de ninguém.
 */
export async function salvarProduto(
  storeId: number,
  offerId: number,
  dados: { foto?: string | null; descricao?: string | null; ficha?: Array<{ k: string; v: string }> },
): Promise<{ ok: boolean; erro?: string }> {
  const [r] = await pool
    .query(
      `SELECT p.id AS product_id, p.primary_image_url AS foto, p.description AS descricao, p.specs,
              (SELECT COUNT(*) FROM offer o2
                WHERE o2.variant_id = o.variant_id AND o2.store_id <> o.store_id) AS outras_lojas
         FROM offer o
         JOIN product_variant v ON v.id = o.variant_id
         JOIN product p ON p.id = v.product_id
        WHERE o.id = ? AND o.store_id = ? LIMIT 1`,
      [offerId, storeId],
    )
    .catch(() => [null]);
  if (!r) return { ok: false, erro: "produto não encontrado nesta loja" };

  const compartilhado = Number(r.outras_lojas ?? 0) > 0;
  const sets: string[] = [];
  const args: unknown[] = [];

  const podeGravar = (campoAtual: unknown) => !compartilhado || !campoAtual;

  if (dados.foto !== undefined && podeGravar(r.foto)) {
    sets.push("primary_image_url = ?");
    args.push(dados.foto);
  }
  if (dados.descricao !== undefined && podeGravar(r.descricao)) {
    sets.push("description = ?");
    args.push(dados.descricao);
  }
  if (dados.ficha !== undefined) {
    const tinha = r.specs && String(r.specs).length > 2;
    if (podeGravar(tinha ? r.specs : null)) {
      sets.push("specs = ?");
      args.push(JSON.stringify(dados.ficha.filter((f) => f.k?.trim() && f.v?.trim()).slice(0, 40)));
    }
  }

  if (!sets.length) {
    return {
      ok: false,
      erro: compartilhado
        ? "este produto também é vendido por outra loja — você só pode preencher o que está em branco"
        : "nada para salvar",
    };
  }
  await pool.query(`UPDATE product SET ${sets.join(", ")} WHERE id = ?`, [...args, r.product_id]);
  return { ok: true };
}

/**
 * Liberar, excluir da lista, ou devolver para análise.
 *
 * ⚠ Liberar exige o produto completo. Sem isto o botão viraria um jeito rápido
 * de publicar exatamente o que este módulo existe para evitar — produto sem
 * foto e sem descrição.
 */
export async function mudarEstado(
  storeId: number,
  offerId: number,
  acao: "liberar" | "excluir" | "devolver",
): Promise<{ ok: boolean; erro?: string }> {
  if (acao === "liberar") {
    const lista = await pool
      .query(
        `SELECT p.primary_image_url AS foto, p.description AS descricao, p.specs
           FROM offer o JOIN product_variant v ON v.id = o.variant_id
           JOIN product p ON p.id = v.product_id
          WHERE o.id = ? AND o.store_id = ? LIMIT 1`,
        [offerId, storeId],
      )
      .catch(() => []);
    if (!lista.length) return { ok: false, erro: "produto não encontrado nesta loja" };
    const falta = oQueFalta(lista[0]);
    if (falta.length) return { ok: false, erro: `ainda falta: ${falta.join(", ")}` };

    await pool.query(
      "UPDATE offer SET in_stock = 1, gone_reason = NULL WHERE id = ? AND store_id = ?",
      [offerId, storeId],
    );
    return { ok: true };
  }

  const motivo = acao === "excluir" ? "excluida" : "analise";
  await pool.query(
    "UPDATE offer SET in_stock = 0, gone_reason = ? WHERE id = ? AND store_id = ?",
    [motivo, offerId, storeId],
  );
  return { ok: true };
}

/** A loja está com a análise ligada? */
export async function analiseAtiva(storeId: number): Promise<boolean> {
  const [r] = await pool
    .query("SELECT analise_ativa FROM store WHERE id = ? LIMIT 1", [storeId])
    .catch(() => [null]);
  return Boolean(r?.analise_ativa);
}
