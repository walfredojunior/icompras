import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const { id } = await params;
  await pool.query("DELETE FROM banner WHERE id = ?", [Number(id)]);
  return NextResponse.json({ ok: true });
}

// Sobe ou desce um banner na ordem em que ele aparece.
//
// Só troca de lugar com banners do MESMO espaço: um banner do topo da home não
// disputa posição com o de uma categoria, e o de "perfume" não disputa com o de
// "celulares". Por isso o grupo é (lugar + categoria).
async function mover(id: number, direcao: "up" | "down"): Promise<void> {
  const linhas = await pool.query("SELECT placement, category_slug FROM banner WHERE id = ? LIMIT 1", [id]);
  if (!linhas.length) return;
  const b = linhas[0];

  // `<=>` é a igualdade que também casa NULL com NULL — os banners da home têm
  // categoria vazia, e com `=` comum o grupo sairia vazio.
  const grupo = await pool.query(
    `SELECT id FROM banner WHERE placement = ? AND (category_slug <=> ?) ORDER BY position, id DESC`,
    [b.placement, b.category_slug],
  );

  // Renumera o grupo ANTES de trocar.
  //
  // Todos os banners nasceram com posição 0 (a tela nunca pediu esse número),
  // então a ordem que aparece hoje vem só do desempate por id. Trocar "zero com
  // zero" não mudaria nada — daí renumerar 0,1,2… primeiro, o que congela
  // exatamente a ordem que o administrador está vendo na tela.
  for (let i = 0; i < grupo.length; i++) {
    await pool.query("UPDATE banner SET position = ? WHERE id = ?", [i, Number(grupo[i].id)]);
  }

  const atual = grupo.findIndex((g: any) => Number(g.id) === id);
  const destino = direcao === "up" ? atual - 1 : atual + 1;
  if (atual < 0 || destino < 0 || destino >= grupo.length) return; // já está na ponta

  await pool.query("UPDATE banner SET position = ? WHERE id = ?", [destino, id]);
  await pool.query("UPDATE banner SET position = ? WHERE id = ?", [atual, Number(grupo[destino].id)]);
}

// Campos que o painel pode alterar num banner já criado.
//
// A lista é fechada de propósito: o corpo do pedido vem do navegador, e sem
// isso bastaria mandar um campo a mais para escrever em qualquer coluna.
async function editar(id: number, e: any): Promise<void> {
  const imagem = typeof e.image_url === "string" && e.image_url.trim() ? e.image_url.trim() : null;
  const lugar = e.placement === "category" ? "category" : "home_hero";
  await pool.query(
    `UPDATE banner
        SET title = ?, link_url = ?, placement = ?, category_slug = ?, store_id = ?, is_paid = ?
            ${imagem ? ", image_url = ?" : ""}
      WHERE id = ?`,
    [
      e.title?.trim() || null,
      e.link_url?.trim() || null,
      lugar,
      lugar === "category" ? e.category_slug || null : null,
      e.store_id ? Number(e.store_id) : null,
      e.is_paid ? 1 : 0,
      ...(imagem ? [imagem] : []),
      id,
    ],
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const { id } = await params;
  const corpo = await req.json().catch(() => ({}));

  if (corpo.move === "up" || corpo.move === "down") {
    await mover(Number(id), corpo.move);
    return NextResponse.json({ ok: true });
  }

  if (corpo.edit && typeof corpo.edit === "object") {
    await editar(Number(id), corpo.edit);
    return NextResponse.json({ ok: true });
  }

  if ("active" in corpo) {
    await pool.query("UPDATE banner SET active = ? WHERE id = ?", [corpo.active ? 1 : 0, Number(id)]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nada a alterar." }, { status: 400 });
}
