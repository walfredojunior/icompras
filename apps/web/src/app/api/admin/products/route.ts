import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

// Busca simples de produtos por nome, para o admin escolher destaques.
export async function GET(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const rows = await pool.query(
    "SELECT id, slug, canonical_name AS name, brand FROM product WHERE canonical_name LIKE ? ORDER BY canonical_name LIMIT 15",
    [`%${q}%`],
  );
  return NextResponse.json({ products: rows });
}
