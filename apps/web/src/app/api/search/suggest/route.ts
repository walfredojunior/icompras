import { NextResponse } from "next/server";
import { suggest } from "@/lib/search";

// Sugestões do campo de busca. Rota pública e leve: devolve só nome e link.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ items: [] });
  try {
    const items = await suggest(q, 7);
    return NextResponse.json({ items });
  } catch {
    // Buscador fora do ar não pode quebrar o campo de busca.
    return NextResponse.json({ items: [] });
  }
}
