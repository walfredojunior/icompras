import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";
import { lancarNaConta } from "@/lib/pedidos";

// Colocar um produto em destaque na home — e, se for vendido, cobrar por isso.
//
// ⚠ GANHOU CLIENTE, PERÍODO E VALOR EM 22/08/2026. Antes era só
// `INSERT (product_id, position)`: o destaque entrava e ficava para sempre, sem
// dono e sem data. Ele pediu o mesmo modelo dos banners — escolher o cliente,
// pôr o preço, entrar na conta a receber e ter vencimento.

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const productId = Number(b.productId);
  if (!productId) {
    return NextResponse.json({ error: "Produto inválido." }, { status: 400 });
  }

  const inicio: string | null = b.starts_at || null;
  const fim: string | null = b.ends_at || null;
  if (inicio && fim && inicio > fim) {
    return NextResponse.json({ error: "A data de término é anterior à de início." }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO featured_product (product_id, position, store_id, is_paid, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE position = VALUES(position), store_id = VALUES(store_id),
       is_paid = VALUES(is_paid), starts_at = VALUES(starts_at), ends_at = VALUES(ends_at)`,
    [
      productId,
      Number(b.position ?? 0),
      b.store_id ? Number(b.store_id) : null,
      b.is_paid ? 1 : 0,
      inicio,
      fim,
    ],
  );

  // A conta a receber nasce junto, como nos banners.
  const valor = Number(b.valor ?? 0);
  let lancado: { pedido: string; valor: number } | null = null;
  if (b.store_id && b.is_paid && Number.isFinite(valor) && valor > 0) {
    try {
      lancado = await lancarNaConta({
        destaqueProdutoId: productId,
        storeId: Number(b.store_id),
        titulo: b.titulo ?? null,
        categorySlug: null,
        slot: null,
        inicio,
        fim,
        valor,
        duracao: b.duracao || "mensal",
      });
    } catch {
      // Falhar ao lançar não desfaz o destaque: a tela mostra "ainda não está
      // na conta", que é o aviso para lançar à mão.
      lancado = null;
    }
  }

  return NextResponse.json({ ok: true, lancado });
}
