import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// PREÇOS DE AGORA para os produtos de uma lista.
//
// 💡 POR QUE A LISTA NÃO GUARDA PREÇO. Seria mais simples gravar o preço junto
// com o item no navegador — e seria errado. A pessoa monta a lista hoje e
// viaja daqui a três semanas; mostrar o preço de três semanas atrás é
// exatamente o que um comparador de preços não pode fazer. Aqui os preços são
// buscados toda vez que a lista abre, então a soma acompanha o mercado.
//
// Também é o que dá sentido a compartilhar: quem recebe o link vê o preço de
// hoje, não o do dia em que a lista foi montada.

/** Teto de itens por chamada. Bate com o MAX_ITENS de `listaLocal.ts`. */
const MAX = 100;

export async function POST(req: Request) {
  let ids: number[];
  try {
    const corpo = await req.json();
    ids = Array.isArray(corpo?.ids) ? corpo.ids : [];
  } catch {
    return NextResponse.json({ erro: "pedido inválido" }, { status: 400 });
  }

  // ⚠ LIMPEZA DO QUE VEM DE FORA. Este endereço é público e recebe o que
  // mandarem: filtrar para inteiros positivos e cortar no teto evita tanto
  // injeção quanto alguém pedir 50 mil produtos de uma vez para pesar o banco.
  const limpos = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX);
  if (!limpos.length) return NextResponse.json({ produtos: [] });

  const vagas = limpos.map(() => "?").join(",");

  // ⚠⚠ SEM `COALESCE(..., p.min_price_usd)` AQUI. NUNCA. ⚠⚠
  //
  // A primeira versão fazia exatamente isso, e o dono achou o problema com uma
  // pergunta: *"o que acontece com a lista de favorito se ele saiu da lista?"*
  //
  // `p.min_price_usd` é o ÚLTIMO preço conhecido, e continua lá depois de o
  // produto sair de circulação. Medido em 15/08/2026: **5.168 produtos sem
  // nenhuma oferta no ar, e 5.068 deles ainda com preço guardado** — como a
  // "TV JVC LED 43\" — US$ 179,00", que ninguém mais vende.
  //
  // Com o COALESCE, a lista mostrava esse preço como se fosse atual E somava no
  // total. A pessoa montaria a lista, olharia o total, viajaria ao Paraguai e
  // descobriria na loja que o produto não existe. É o pior tipo de erro que um
  // comparador de preços pode cometer: não é uma tela feia, é uma promessa
  // falsa que só aparece quando já é tarde.
  //
  // Agora o preço só existe se houver oferta ATIVA. Sem oferta, `preco` vem
  // null e a tela mostra "não está mais à venda" — fora da soma.
  const linhas = await pool.query(
    `SELECT p.id, p.slug, p.canonical_name AS nome, p.primary_image_url AS imagem,
            (SELECT MIN(o.price_usd) FROM offer o
               JOIN product_variant v ON v.id = o.variant_id
              WHERE v.product_id = p.id AND o.in_stock = 1) AS preco,
            (SELECT COUNT(DISTINCT o.store_id) FROM offer o
               JOIN product_variant v ON v.id = o.variant_id
              WHERE v.product_id = p.id AND o.in_stock = 1) AS lojas,
            p.min_price_usd AS ultimoPrecoConhecido
       FROM product p
      WHERE p.id IN (${vagas})`,
    limpos,
  );

  return NextResponse.json({
    produtos: linhas.map((r: any) => {
      const preco = r.preco == null ? null : Number(r.preco);
      return {
        id: Number(r.id),
        slug: r.slug,
        nome: r.nome,
        imagem: r.imagem ?? null,
        preco,
        lojas: Number(r.lojas ?? 0),
        // Diz à tela POR QUE não há preço, e a diferença importa:
        //   · saiu do ar → o produto existiu e a pessoa escolheu; mostrar por
        //     quanto era ajuda a decidir se procura um parecido
        //   · nunca teve → produto novo ainda sem oferta coletada
        foraDoAr: preco == null,
        ultimoPreco: r.ultimoPrecoConhecido == null ? null : Number(r.ultimoPrecoConhecido),
      };
    }),
  });
}
