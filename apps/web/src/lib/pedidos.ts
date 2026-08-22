import { pool } from "./db";

// A CONTA-CORRENTE DO CLIENTE — pedidos, itens e pagamentos.
//
// ⚠ POR QUE EXISTE (21/08/2026). O sistema só sabia cobrar assinatura de plano:
// uma loja, um plano, um valor. Ele quer vender espaço de banner por categoria
// e outros serviços, com mais de um item por cliente, e lançar na conta o que
// cobrou ou vai cobrar. Isso não cabe em `subscription`/`payment`, que exigem
// um plano por trás.
//
// 💡 O item vendido é que liga o banner (`banner_id`). Assim a venda fica
// registrada mesmo que o banner seja apagado depois — o dinheiro cobrado não
// pode sumir junto com uma imagem.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PedidoItem {
  id: number;
  pedido_id: number;
  tipo: string;
  descricao: string;
  category_slug: string | null;
  banner_id: number | null;
  inicio: string | null;
  fim: string | null;
  valor: number;
  /**
   * O estado do banner deste item, para a conta mostrar se o que foi vendido
   * está de fato no ar.
   *
   * ⚠ Ele reparou que a conta não dizia isso (22/08/2026): "um banner não tá
   * vinculado ao banner que tá ativo". Item cobrado com o banner fora do ar é
   * cliente pagando por nada — e o contrário (no ar sem cobrar) é o inverso.
   */
  banner_estado?: "no_ar" | "fora_do_ar" | "apagado" | null;
}

export interface Pagamento {
  id: number;
  valor: number;
  pago_em: string;
  forma: string | null;
  observacao: string | null;
}

export interface Pedido {
  id: number;
  store_id: number;
  store_name?: string;
  numero: string;
  status: string;
  currency: string;
  emitido_em: string | null;
  observacao: string | null;
  itens: PedidoItem[];
  /**
   * Os recebimentos, um por um.
   *
   * ⚠ A forma de pagamento era gravada e NUNCA mostrada (visto em 22/08/2026):
   * ele registrava "recebi por transferência" e não tinha onde conferir depois.
   * Guardar dado que ninguém vê é o mesmo que não guardar.
   */
  pagamentos: Pagamento[];
  total: number;
  pago: number;
  aberto: number;
}

/** Soma dos itens, do que foi pago, e o que falta. */
function fecharContas(p: any, itens: PedidoItem[], pagamentos: Pagamento[]): Pedido {
  const total = itens.reduce((s, i) => s + Number(i.valor), 0);
  const pago = pagamentos.reduce((s, g) => s + Number(g.valor), 0);
  return {
    ...p,
    id: Number(p.id),
    store_id: Number(p.store_id),
    itens,
    pagamentos,
    total,
    pago,
    // Arredonda para 2 casas: soma de decimais em ponto flutuante pode
    // devolver 0.00000001 e a tela mostraria "falta R$ 0,00" num pedido quitado.
    aberto: Math.round((total - pago) * 100) / 100,
  };
}

/** Todos os pedidos de uma loja, com itens e o quanto já foi pago. */
export async function pedidosDaLoja(storeId: number): Promise<Pedido[]> {
  const pedidos = await pool.query(
    `SELECT p.*, s.name AS store_name
       FROM pedido p JOIN store s ON s.id = p.store_id
      WHERE p.store_id = ?
      ORDER BY p.emitido_em DESC, p.id DESC`,
    [storeId],
  );
  if (!pedidos.length) return [];
  return montar(pedidos);
}

/** Os pedidos mais recentes de todas as lojas (tela do admin). */
export async function pedidosRecentes(limite = 50): Promise<Pedido[]> {
  const pedidos = await pool.query(
    `SELECT p.*, s.name AS store_name
       FROM pedido p JOIN store s ON s.id = p.store_id
      ORDER BY p.emitido_em DESC, p.id DESC
      LIMIT ?`,
    [limite],
  );
  if (!pedidos.length) return [];
  return montar(pedidos);
}

/**
 * Junta itens e pagamentos aos pedidos.
 *
 * 💡 DUAS CONSULTAS PARA TODOS OS PEDIDOS, e não duas por pedido: com 50
 * pedidos na tela, o jeito ingênuo faria 101 idas ao banco. Aqui são 3.
 */
async function montar(pedidos: any[]): Promise<Pedido[]> {
  const ids = pedidos.map((p) => Number(p.id));
  const marcas = ids.map(() => "?").join(",");

  const itens = await pool.query(
    `SELECT i.*,
            CASE
              WHEN i.banner_id IS NULL THEN NULL
              WHEN b.id IS NULL THEN 'apagado'
              WHEN b.active = 1
                   AND (b.starts_at IS NULL OR b.starts_at <= NOW())
                   AND (b.ends_at IS NULL OR b.ends_at >= NOW()) THEN 'no_ar'
              ELSE 'fora_do_ar'
            END AS banner_estado
       FROM pedido_item i
       LEFT JOIN banner b ON b.id = i.banner_id
      WHERE i.pedido_id IN (${marcas}) ORDER BY i.id`,
    ids,
  );
  // Um por um, e não só a soma: a tela mostra data, valor e forma de cada
  // recebimento.
  const pagos = await pool.query(
    `SELECT id, pedido_id, valor, pago_em, forma, observacao
       FROM pedido_pagamento WHERE pedido_id IN (${marcas}) ORDER BY pago_em, id`,
    ids,
  );

  const porPedido = new Map<number, PedidoItem[]>();
  for (const i of itens) {
    const k = Number(i.pedido_id);
    if (!porPedido.has(k)) porPedido.set(k, []);
    porPedido.get(k)!.push({ ...i, id: Number(i.id), valor: Number(i.valor) });
  }
  const pagoPor = new Map<number, Pagamento[]>();
  for (const g of pagos) {
    const k = Number(g.pedido_id);
    if (!pagoPor.has(k)) pagoPor.set(k, []);
    pagoPor.get(k)!.push({
      id: Number(g.id),
      valor: Number(g.valor),
      pago_em: String(g.pago_em).slice(0, 10),
      forma: g.forma ?? null,
      observacao: g.observacao ?? null,
    });
  }

  return pedidos.map((p) =>
    fecharContas(p, porPedido.get(Number(p.id)) ?? [], pagoPor.get(Number(p.id)) ?? []),
  );
}

/**
 * O próximo número do pedido, no formato AAAA-0001.
 *
 * ⚠ Reinicia a cada ano de propósito, e o ano faz parte do número — assim
 * "2027-0001" nunca colide com "2026-0001", e a numeração fica legível.
 */
export async function proximoNumero(): Promise<string> {
  const ano = new Date().getFullYear();
  const linhas = await pool.query(
    `SELECT numero FROM pedido WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1`,
    [`${ano}-%`],
  );
  const ultimo = linhas[0]?.numero as string | undefined;
  const n = ultimo ? Number(ultimo.split("-")[1]) + 1 : 1;
  return `${ano}-${String(n).padStart(4, "0")}`;
}

/** Quanto cada loja deve, somando todos os pedidos em aberto. */
export async function emAbertoPorLoja(): Promise<Array<{ store_id: number; store_name: string; aberto: number }>> {
  const linhas = await pool.query(
    `SELECT p.store_id, s.name AS store_name,
            COALESCE(SUM(i.valor), 0) - COALESCE(SUM(g.pago), 0) AS aberto
       FROM pedido p
       JOIN store s ON s.id = p.store_id
       LEFT JOIN (SELECT pedido_id, SUM(valor) AS valor FROM pedido_item GROUP BY pedido_id) i
              ON i.pedido_id = p.id
       LEFT JOIN (SELECT pedido_id, SUM(valor) AS pago FROM pedido_pagamento GROUP BY pedido_id) g
              ON g.pedido_id = p.id
      WHERE p.status IN ('aberto', 'rascunho')
      GROUP BY p.store_id, s.name
     HAVING aberto > 0
      ORDER BY aberto DESC`,
  );
  return linhas.map((l: any) => ({
    store_id: Number(l.store_id),
    store_name: l.store_name,
    aberto: Number(l.aberto),
  }));
}

/**
 * O resumo comercial: o que está no ar, o que vence e o que não foi cobrado.
 *
 * ⚠ "NO AR SEM COBRAR" É O NÚMERO QUE MAIS IMPORTA (21/08/2026). Banner pago,
 * publicado, e que ninguém lançou na conta é dinheiro escapando — e sem este
 * resumo só se descobre olhando banner por banner.
 */
export async function resumoComercial(): Promise<{
  emAberto: number;
  clientesDevendo: number;
  vencendo7: number;
  semCobrar: number;
}> {
  // ⚠ CONTA OS TRÊS SERVIÇOS (22/08/2026): banner, destaque de produto e bloco.
  // Enquanto só o banner era vendável, olhar uma tabela bastava; com destaque e
  // bloco também vendáveis, um painel que ignorasse os dois mostraria menos
  // dívida do que existe.
  const [linha]: any = await pool.query(
    `SELECT
       -- Vence nos próximos 7 dias: é a janela para renovar antes de sair do ar.
       (SELECT COUNT(*) FROM banner
         WHERE active = 1 AND ends_at IS NOT NULL
           AND ends_at >= NOW() AND ends_at <= NOW() + INTERVAL 7 DAY)
       + (SELECT COUNT(*) FROM featured_product
           WHERE ends_at IS NOT NULL AND ends_at >= NOW() AND ends_at <= NOW() + INTERVAL 7 DAY)
       + (SELECT COUNT(*) FROM category_block
           WHERE active = 1 AND ends_at IS NOT NULL
             AND ends_at >= NOW() AND ends_at <= NOW() + INTERVAL 7 DAY) AS vencendo7,
       -- Pago e no ar, mas sem item de venda nenhum apontando para ele.
       (SELECT COUNT(*) FROM banner b
         WHERE b.is_paid = 1 AND b.active = 1
           AND NOT EXISTS (SELECT 1 FROM pedido_item i WHERE i.banner_id = b.id))
       + (SELECT COUNT(*) FROM featured_product f
           WHERE f.is_paid = 1
             AND NOT EXISTS (SELECT 1 FROM pedido_item i WHERE i.destaque_produto_id = f.product_id))
       + (SELECT COUNT(*) FROM category_block c
           WHERE c.is_paid = 1 AND c.active = 1
             AND NOT EXISTS (SELECT 1 FROM pedido_item i WHERE i.bloco_id = c.id)) AS semCobrar`,
  );

  const devedores = await emAbertoPorLoja();
  return {
    emAberto: devedores.reduce((s, d) => s + d.aberto, 0),
    clientesDevendo: devedores.length,
    vencendo7: Number(linha?.vencendo7 ?? 0),
    semCobrar: Number(linha?.semCobrar ?? 0),
  };
}

/**
 * Lança um banner na conta do cliente: acha (ou cria) o pedido e grava o item.
 *
 * ⚠ UMA FUNÇÃO SÓ, usada por DOIS caminhos (22/08/2026): a criação do banner
 * com valor preenchido, e o botão "lançar na conta" da lista. Duplicar a regra
 * era garantir que uma das duas ficasse para trás na primeira mudança.
 *
 * 💡 Aproveita um pedido em aberto da loja em vez de criar um por banner —
 * senão um cliente com três espaços vendidos teria três notas para acompanhar.
 */
export async function lancarNaConta(dados: {
  /** O que foi vendido. Só um dos três vem preenchido. */
  bannerId?: number | null;
  destaqueProdutoId?: number | null;
  blocoId?: number | null;
  restauranteId?: number | null;
  storeId: number;
  titulo: string | null;
  placement?: string;
  categorySlug: string | null;
  slot: string | null;
  inicio: string | null;
  fim: string | null;
  valor: number;
  duracao: string;
  precoId?: number | null;
  /** Sobrepõe o tipo do item — usado pelo guia, que vende "estar na lista" e
   *  "destaque no topo" como produtos diferentes do mesmo cadastro. */
  tipoForcado?: string | null;
}): Promise<{ pedido: string; valor: number }> {
  // Já lançado? Não duplica. A coluna varia com o que está sendo vendido.
  const coluna = dados.bannerId
    ? "banner_id"
    : dados.destaqueProdutoId
      ? "destaque_produto_id"
      : dados.blocoId
        ? "bloco_id"
        : "restaurante_id";
  const refId =
    dados.bannerId ?? dados.destaqueProdutoId ?? dados.blocoId ?? dados.restauranteId;
  if (!refId) throw new Error("Nada para lançar: informe banner, destaque ou bloco.");

  const [jaTem]: any = await pool.query(
    `SELECT p.numero FROM pedido_item i JOIN pedido p ON p.id = i.pedido_id
      WHERE i.${coluna} = ? LIMIT 1`,
    [refId],
  );
  if (jaTem) return { pedido: jaTem.numero, valor: dados.valor };

  const [aberto]: any = await pool.query(
    `SELECT id, numero FROM pedido WHERE store_id = ? AND status IN ('aberto','rascunho')
      ORDER BY id DESC LIMIT 1`,
    [dados.storeId],
  );
  let pedidoId: number;
  let numero: string;
  if (aberto) {
    pedidoId = Number(aberto.id);
    numero = aberto.numero;
  } else {
    numero = await proximoNumero();
    const r: any = await pool.query(
      `INSERT INTO pedido (store_id, numero, status, emitido_em) VALUES (?, ?, 'aberto', CURDATE())`,
      [dados.storeId, numero],
    );
    pedidoId = Number(r.insertId);
  }

  const onde = dados.restauranteId
    ? "Onde comer no Paraguai"
    : dados.destaqueProdutoId
      ? "Destaque de produto na página inicial"
      : dados.blocoId
        ? "Bloco de destaque na página inicial"
      : dados.placement === "category"
        ? `Banner ${dados.slot ?? "topo"} · ${dados.categorySlug ?? ""}`
        : dados.placement === "restaurante"
          ? "Onde comer no Paraguai"
          : "Banner na página inicial";
  const descricao = dados.titulo ? `${onde} · ${dados.titulo}` : onde;

  const tipo = dados.tipoForcado
    ? dados.tipoForcado
    : dados.destaqueProdutoId
      ? "destaque"
      : dados.blocoId
        ? "bloco"
      : dados.placement === "category"
        ? "banner_categoria"
        : dados.placement === "home_hero"
          ? "banner_home"
          : "outro";

  await pool.query(
    `INSERT INTO pedido_item
       (pedido_id, tipo, descricao, category_slug, slot,
        banner_id, destaque_produto_id, bloco_id, restaurante_id,
        inicio, fim, valor, preco_id, duracao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pedidoId,
      tipo,
      descricao,
      dados.categorySlug,
      dados.placement === "category" ? dados.slot : null,
      dados.bannerId ?? null,
      dados.destaqueProdutoId ?? null,
      dados.blocoId ?? null,
      dados.restauranteId ?? null,
      dados.inicio,
      dados.fim,
      dados.valor,
      dados.precoId ?? null,
      dados.duracao,
    ],
  );
  return { pedido: numero, valor: dados.valor };
}
