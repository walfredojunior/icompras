import { NextResponse } from "next/server";
import { getCurrentStore } from "@/lib/storeauth";
import { salvarProduto, mudarEstado } from "@/lib/produtosDaLoja";

// Ações da loja sobre os próprios produtos (migração 054).
//
// ⚠ TODA função recebe o `store.id` da SESSÃO, nunca do corpo do pedido, e
// todo UPDATE leva `AND store_id = ?`. Sem isso, uma loja poderia mandar o id
// de uma oferta da concorrente e editar ou tirar do ar o produto dela.

export async function POST(req: Request) {
  const loja = await getCurrentStore();
  if (!loja) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as {
    acao?: string;
    offerId?: number;
    foto?: string | null;
    descricao?: string | null;
    ficha?: Array<{ k: string; v: string }>;
  };

  const offerId = Number(b.offerId);
  if (!offerId) return NextResponse.json({ error: "produto não informado" }, { status: 400 });

  if (b.acao === "salvar") {
    const r = await salvarProduto(loja.id, offerId, {
      foto: b.foto,
      descricao: b.descricao,
      ficha: b.ficha,
    });
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 400 });
  }

  if (b.acao === "liberar" || b.acao === "excluir" || b.acao === "devolver") {
    const r = await mudarEstado(loja.id, offerId, b.acao);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.erro }, { status: 400 });
  }

  return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
}
