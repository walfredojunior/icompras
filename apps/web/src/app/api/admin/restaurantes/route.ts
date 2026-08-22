import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";
import { lancarNaConta } from "@/lib/pedidos";
import { slugDoNome, TIPOS } from "@/lib/restaurantes";

// Cadastro do guia "Onde comer no Paraguai".
//
// ⚠ A LISTAGEM É UM PRODUTO VENDIDO, como banner e destaque: tem cliente,
// período e valor, e entra na conta a receber no mesmo ato.

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));

  const nome = String(b.nome ?? "").trim();
  const cidade = String(b.cidade ?? "").trim();
  if (!nome) return NextResponse.json({ error: "Escreva o nome do restaurante." }, { status: 400 });
  if (!cidade) return NextResponse.json({ error: "Escreva a cidade." }, { status: 400 });

  // Lista fechada: o valor vem do navegador e vai para uma coluna com valores
  // fixos. Fora da lista, cai em "outros" em vez de gravar vazio.
  const tipo = TIPOS.some((x) => x.id === b.tipo) ? b.tipo : "outros";

  const inicio: string | null = b.starts_at || null;
  const fim: string | null = b.ends_at || null;
  if (inicio && fim && inicio > fim) {
    return NextResponse.json({ error: "A data de término é anterior à de início." }, { status: 400 });
  }

  // ⚠ O ENDEREÇO CURTO PRECISA SER ÚNICO. Dois "Cantina do Porto" em cidades
  // diferentes gerariam o mesmo, e a chave única recusaria o segundo cadastro
  // com uma mensagem que não diz nada. Aqui o segundo vira "cantina-do-porto-2".
  const id = Number(b.id ?? 0);
  let slug = slugDoNome(nome);
  const iguais = await pool.query(
    "SELECT slug FROM restaurante WHERE slug = ? OR slug LIKE ? " + (id ? "AND id <> ?" : ""),
    id ? [slug, `${slug}-%`, id] : [slug, `${slug}-%`],
  );
  if (iguais.some((x: any) => x.slug === slug)) {
    slug = `${slug}-${iguais.length + 1}`;
  }

  const campos = [
    nome,
    slug,
    b.foto_url || null,
    cidade,
    tipo,
    b.link?.trim() || null,
    b.whatsapp?.trim() || null,
    b.endereco?.trim() || null,
    b.descricao?.trim() || null,
    b.store_id ? Number(b.store_id) : null,
    b.is_paid ? 1 : 0,
    b.destaque ? 1 : 0,
    inicio,
    fim,
    b.active === false ? 0 : 1,
  ];

  let restauranteId = id;
  if (restauranteId > 0) {
    await pool.query(
      `UPDATE restaurante SET nome=?, slug=?, foto_url=?, cidade=?, tipo=?, link=?, whatsapp=?,
              endereco=?, descricao=?, store_id=?, is_paid=?, destaque=?, starts_at=?, ends_at=?, active=?
        WHERE id = ?`,
      [...campos, restauranteId],
    );
  } else {
    const r: any = await pool.query(
      `INSERT INTO restaurante
         (nome, slug, foto_url, cidade, tipo, link, whatsapp, endereco, descricao,
          store_id, is_paid, destaque, starts_at, ends_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      campos,
    );
    restauranteId = Number(r.insertId);
  }

  // A conta a receber nasce junto, como nos banners e destaques.
  const valor = Number(b.valor ?? 0);
  let lancado: { pedido: string; valor: number } | null = null;
  if (b.store_id && b.is_paid && Number.isFinite(valor) && valor > 0) {
    try {
      lancado = await lancarNaConta({
        restauranteId,
        storeId: Number(b.store_id),
        titulo: nome,
        categorySlug: null,
        slot: null,
        inicio,
        fim,
        valor,
        duracao: b.duracao || "mensal",
        // O tipo do item muda com o produto vendido: estar na lista, ou estar
        // em destaque no topo dela.
        tipoForcado: b.destaque ? "restaurante_destaque" : "restaurante",
      });
    } catch {
      lancado = null;
    }
  }

  return NextResponse.json({ ok: true, id: restauranteId, lancado });
}

export async function DELETE(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Restaurante não informado." }, { status: 400 });
  // O item de venda NÃO some junto: o vínculo vira nulo (ON DELETE SET NULL) e
  // o que foi cobrado continua registrado.
  await pool.query("DELETE FROM restaurante WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
