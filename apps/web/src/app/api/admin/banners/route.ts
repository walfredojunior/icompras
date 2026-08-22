import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";
import { normalizarDestino } from "@/lib/bannerDestino";
import { categoriaOcupadaPor, dataBR } from "@/lib/banners";
import { lancarNaConta } from "@/lib/pedidos";

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  if (!b.image_url) {
    return NextResponse.json({ error: "Imagem obrigatória." }, { status: 400 });
  }
  // Um banner que aponta para loja precisa da loja escolhida, senão nasce sem
  // clique nenhum e o dono só descobre testando.
  if (b.destino_tipo === "loja" && !b.store_id) {
    return NextResponse.json({ error: "Escolha a loja de destino." }, { status: 400 });
  }
  const d = normalizarDestino(b);
  if ((d.destino_tipo === "busca" || d.destino_tipo === "marca") && !d.busca) {
    return NextResponse.json({ error: "Escreva o que a busca deve procurar." }, { status: 400 });
  }
  if (d.destino_tipo === "link" && !d.link_url) {
    return NextResponse.json({ error: "Informe o endereço do link." }, { status: 400 });
  }

  // Período contratado. Vazio = sem limite daquele lado.
  const inicio: string | null = b.starts_at || null;
  const fim: string | null = b.ends_at || null;
  if (inicio && fim && inicio > fim) {
    return NextResponse.json({ error: "A data de término é anterior à de início." }, { status: 400 });
  }

  // ⚠⚠ A TRAVA DE EXCLUSIVIDADE DE VERDADE (21/08/2026).
  //
  // A tela já avisa enquanto se digita, mas o aviso da tela é conveniência, não
  // garantia: duas janelas abertas ao mesmo tempo — ou um pedido montado à mão
  // — passariam por cima dele. Quem SEGURA é esta conferência, aqui.
  //
  // 💡 Só conflita quem se sobrepõe no TEMPO: vender outubro enquanto setembro
  // está no ar é legítimo, e é assim que se vende com antecedência.
  // Espaço da categoria: topo, meio ou fim. Lista fechada porque o valor vem
  // do navegador e é gravado numa coluna com valores fixos.
  const ESPACOS = ["topo", "meio", "fim"] as const;
  const slot = ESPACOS.includes(b.slot) ? b.slot : "topo";

  if ((b.placement ?? "home_hero") === "category") {
    if (!b.category_slug) {
      return NextResponse.json({ error: "Escolha a categoria." }, { status: 400 });
    }
    const ocupada = await categoriaOcupadaPor(b.category_slug, inicio, fim, undefined, slot);
    if (ocupada) {
      const nome = ocupada.title || ocupada.store_name || `banner ${ocupada.id}`;
      const ate = ocupada.ends_at
        ? ` (no ar até ${dataBR(ocupada.ends_at)})`
        : " (sem data de término)";
      const onde = slot === "topo" ? "topo" : slot === "meio" ? "meio" : "fim";
      return NextResponse.json(
        {
          error: `O ${onde} desta categoria já está ocupado por "${nome}"${ate}. Escolha outro espaço, outro período ou outra categoria.`,
        },
        { status: 409 },
      );
    }
  }

  const r: any = await pool.query(
    `INSERT INTO banner (title, image_url, link_url, destino_tipo, busca, placement, category_slug,
                         store_id, is_paid, position, active, starts_at, ends_at, slot, cidade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      b.title ?? null,
      b.image_url,
      d.link_url,
      d.destino_tipo,
      d.busca,
      b.placement ?? "home_hero",
      b.placement === "category" ? b.category_slug ?? null : null,
      b.store_id ?? null,
      b.is_paid ? 1 : 0,
      Number(b.position ?? 0),
      b.active === false ? 0 : 1,
      inicio,
      fim,
      (b.placement ?? "home_hero") === "category" ? slot : null,
      b.placement === "restaurante" ? (b.cidade || null) : null,
    ],
  );
  const bannerId = Number(r.insertId);

  // ⚠⚠ A CONTA A RECEBER NASCE JUNTO COM O BANNER (22/08/2026).
  //
  // Ele perguntou: "não era melhor ali no banner, se eu colocar o cliente tem
  // também o valor e ele já entrar no contas a receber?". Estava certo. Antes
  // eram dois passos — criar o banner e depois clicar em "lançar na conta" — e
  // o segundo era fácil de esquecer: nos testes, **9 banners pagos ficaram no
  // ar sem cobrança nenhuma**. Agora, banner pago + loja + valor entra na conta
  // no mesmo ato.
  //
  // 💡 O botão "lançar na conta" da lista CONTINUA existindo, para os banners
  // criados sem valor e para os que já estavam no ar antes desta mudança.
  const valor = Number(b.valor ?? 0);
  let lancado: { pedido: string; valor: number } | null = null;
  if (b.store_id && b.is_paid && Number.isFinite(valor) && valor > 0) {
    try {
      lancado = await lancarNaConta({
        bannerId,
        storeId: Number(b.store_id),
        titulo: b.title ?? null,
        placement: b.placement ?? "home_hero",
        categorySlug: b.category_slug ?? null,
        slot,
        inicio,
        fim,
        valor,
        duracao: b.duracao || "mensal",
      });
    } catch {
      // ⚠ Falha ao lançar NÃO desfaz o banner: ele já está criado e no ar, e
      // apagá-lo agora seria pior. A tela de Vendas mostra "no ar sem cobrar",
      // que é exatamente o aviso para lançar à mão.
      lancado = null;
    }
  }

  // Devolve o id: a tela usa para oferecer "lançar na conta do cliente" quando
  // o valor não foi informado.
  return NextResponse.json({ ok: true, id: bannerId, lancado });
}
