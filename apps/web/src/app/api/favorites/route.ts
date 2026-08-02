import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toggleFavorite } from "@/lib/favorites";

// Liga/desliga o produto na lista de favoritos de quem está logado.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "login" }, { status: 401 });
  }
  const { productId } = await req.json().catch(() => ({}));
  const id = Number(productId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "produto inválido" }, { status: 400 });
  }
  const favorito = await toggleFavorite(user.id, id);
  return NextResponse.json({ ok: true, favorito });
}
