import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";
import { lancarNaConta, proximoNumero } from "@/lib/pedidos";
import { precoSugerido } from "@/lib/precos";

// A conta do cliente: criar pedido, lançar item, registrar pagamento.
//
// ⚠ Uma rota só, com um campo `acao`, em vez de quatro rotas. São operações
// curtas sobre o mesmo assunto e todas exigem admin — separar aqui só criaria
// quatro arquivos com a mesma conferência de acesso copiada.

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));

  // ---------------------------------------------------------- novo pedido
  if (b.acao === "criar") {
    const storeId = Number(b.store_id);
    if (!storeId) return NextResponse.json({ error: "Escolha o cliente." }, { status: 400 });
    const numero = await proximoNumero();
    const r: any = await pool.query(
      `INSERT INTO pedido (store_id, numero, status, emitido_em, observacao)
       VALUES (?, ?, 'aberto', CURDATE(), ?)`,
      [storeId, numero, b.observacao || null],
    );
    return NextResponse.json({ ok: true, id: Number(r.insertId), numero });
  }

  // ------------------------------------------------------------ novo item
  if (b.acao === "item") {
    const pedidoId = Number(b.pedido_id);
    if (!pedidoId) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });
    if (!b.descricao?.trim()) {
      return NextResponse.json({ error: "Escreva o que está sendo vendido." }, { status: 400 });
    }
    if (b.inicio && b.fim && b.inicio > b.fim) {
      return NextResponse.json({ error: "A data de término é anterior à de início." }, { status: 400 });
    }
    await pool.query(
      `INSERT INTO pedido_item (pedido_id, tipo, descricao, category_slug, banner_id, inicio, fim, valor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pedidoId,
        b.tipo || "outro",
        b.descricao.trim(),
        b.category_slug || null,
        b.banner_id ? Number(b.banner_id) : null,
        b.inicio || null,
        b.fim || null,
        Number(b.valor ?? 0),
      ],
    );
    return NextResponse.json({ ok: true });
  }

  // ------------------------------------------------------- novo pagamento
  if (b.acao === "pagamento") {
    const pedidoId = Number(b.pedido_id);
    const valor = Number(b.valor);
    if (!pedidoId) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
    }

    // ⚠⚠ NÃO RECEBER MAIS QUE O DEVIDO (pedido dele em 22/08/2026).
    //
    // Sem esta trava, um erro de digitação (100 em vez de 10) deixaria o pedido
    // com saldo NEGATIVO — e a tela de Vendas passaria a mostrar menos dívida
    // do que existe, porque o crédito de um cliente abateria o total geral.
    //
    // 💡 A conferência é aqui, no servidor, e não só na tela: duas janelas
    // abertas registrando ao mesmo tempo furariam um aviso de navegador.
    const [conta]: any = await pool.query(
      `SELECT COALESCE((SELECT SUM(valor) FROM pedido_item WHERE pedido_id = ?), 0) AS total,
              COALESCE((SELECT SUM(valor) FROM pedido_pagamento WHERE pedido_id = ?), 0) AS pago`,
      [pedidoId, pedidoId],
    );
    const total = Number(conta?.total ?? 0);
    const jaPago = Number(conta?.pago ?? 0);
    // Centavos em ponto flutuante somam 0.00000001; arredondar evita recusar um
    // pagamento que fecha a conta exatamente.
    const emAberto = Math.round((total - jaPago) * 100) / 100;

    const dol = (n: number) => `US$ ${n.toFixed(2).replace(".", ",")}`;
    if (total <= 0) {
      return NextResponse.json(
        { error: "Este pedido ainda não tem itens. Lance o que foi vendido antes de receber." },
        { status: 400 },
      );
    }
    if (emAberto <= 0) {
      return NextResponse.json(
        { error: `Este pedido já está quitado (${dol(total)}). Não há o que receber.` },
        { status: 400 },
      );
    }
    if (Math.round(valor * 100) / 100 > emAberto) {
      return NextResponse.json(
        {
          error: `Este pedido tem ${dol(emAberto)} em aberto — não dá para receber ${dol(valor)}. Se o cliente pagou a mais, lance o serviço extra como item antes.`,
        },
        { status: 400 },
      );
    }
    await pool.query(
      `INSERT INTO pedido_pagamento (pedido_id, valor, pago_em, forma, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [pedidoId, valor, b.pago_em || new Date().toISOString().slice(0, 10), b.forma || null, b.observacao || null],
    );
    // Quitou? O pedido passa a 'pago' sozinho — ninguém vai lembrar de mudar
    // o estado à mão, e um pedido quitado marcado como aberto polui a lista de
    // quem deve.
    const [soma]: any = await pool.query(
      `SELECT COALESCE((SELECT SUM(valor) FROM pedido_item WHERE pedido_id = ?), 0) AS total,
              COALESCE((SELECT SUM(valor) FROM pedido_pagamento WHERE pedido_id = ?), 0) AS pago`,
      [pedidoId, pedidoId],
    );
    if (Number(soma.pago) >= Number(soma.total) && Number(soma.total) > 0) {
      await pool.query(`UPDATE pedido SET status = 'pago' WHERE id = ?`, [pedidoId]);
    }
    return NextResponse.json({ ok: true });
  }

  // ------------------------------------- lançar um BANNER na conta do cliente
  //
  // ⚠ POR QUE ISTO EXISTE (21/08/2026). Ele perguntou: "não sei como esses
  // banners entram na conta do cliente". Estava certo — eu tinha construído as
  // duas telas SEM ligação: era preciso criar o banner numa, e na outra digitar
  // à mão a descrição, a categoria e as datas de novo. Retrabalho garantido, e
  // dava para vender setembro e pôr o banner em outubro sem ninguém notar.
  //
  // 💡 Aqui o item nasce DO BANNER: categoria, espaço, período e loja vêm
  // copiados dele, e `banner_id` guarda o vínculo. O valor vem da tabela de
  // preços, mas pode ser alterado — negociação existe.
  if (b.acao === "lancar_banner") {
    const bannerId = Number(b.banner_id);
    if (!bannerId) return NextResponse.json({ error: "Banner não informado." }, { status: 400 });

    const [ban]: any = await pool.query(`SELECT * FROM banner WHERE id = ? LIMIT 1`, [bannerId]);
    if (!ban) return NextResponse.json({ error: "Banner não encontrado." }, { status: 404 });
    if (!ban.store_id) {
      return NextResponse.json(
        { error: "Este banner não está ligado a nenhuma loja. Escolha a loja no banner primeiro." },
        { status: 400 },
      );
    }

    const [jaTem]: any = await pool.query(
      `SELECT p.numero FROM pedido_item i JOIN pedido p ON p.id = i.pedido_id
        WHERE i.banner_id = ? LIMIT 1`,
      [bannerId],
    );
    if (jaTem) {
      return NextResponse.json(
        { error: `Este banner já está lançado no pedido ${jaTem.numero}.` },
        { status: 409 },
      );
    }

    const slot = ban.slot ?? "topo";
    const duracao = b.duracao || "mensal";
    let valor = Number(b.valor ?? 0);
    let precoId: number | null = b.preco_id ? Number(b.preco_id) : null;
    // Sem valor informado, busca o de tabela — é o caso do botão da lista.
    if (!valor && ban.category_slug) {
      const sug = await precoSugerido(ban.category_slug, slot, duracao);
      if (sug) {
        valor = sug.valor;
        precoId = sug.linha.id;
      }
    }

    // ⚠ MESMA FUNÇÃO que a criação do banner usa (lib/pedidos.ts). Antes a
    // regra estava escrita duas vezes; na primeira mudança, uma das duas
    // ficaria para trás.
    const r = await lancarNaConta({
      bannerId,
      storeId: Number(ban.store_id),
      titulo: ban.title ?? null,
      placement: ban.placement,
      categorySlug: ban.category_slug ?? null,
      slot,
      inicio: ban.starts_at ? String(ban.starts_at).slice(0, 10) : null,
      fim: ban.ends_at ? String(ban.ends_at).slice(0, 10) : null,
      valor,
      duracao,
      precoId,
    });
    return NextResponse.json({ ok: true, pedido: r.pedido });
  }

  // -------------------------------------------------------------- apagar
  if (b.acao === "apagar_item") {
    await pool.query(`DELETE FROM pedido_item WHERE id = ?`, [Number(b.item_id)]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
}
