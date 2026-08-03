import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";
import { normalizarDestino } from "@/lib/bannerDestino";

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
  await pool.query(
    `INSERT INTO banner (title, image_url, link_url, destino_tipo, busca, placement, category_slug,
                         store_id, is_paid, position, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ],
  );
  return NextResponse.json({ ok: true });
}
