import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { registrarCliqueLoja } from "@/lib/analytics";

// Saída contada para a loja.
//
// O visitante clica no site ou no WhatsApp da loja e passa por aqui: contamos
// e mandamos adiante. É esse número que permite dizer ao lojista "o iCompras
// te enviou N visitantes este mês".
//
// Fica fora de [locale] de propósito: é um redirecionamento, não uma página.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storeId = Number(id);
  const alvo = new URL(req.url).searchParams.get("para") === "whatsapp" ? "whatsapp" : "site";
  const origem = new URL(req.url).origin;

  if (!Number.isFinite(storeId) || storeId <= 0) return NextResponse.redirect(origem);

  const rows = await pool.query("SELECT external_url, phone FROM store WHERE id = ? LIMIT 1", [storeId]);
  if (!rows.length) return NextResponse.redirect(origem);

  const destino =
    alvo === "whatsapp"
      ? rows[0].phone
        ? `https://wa.me/${String(rows[0].phone).replace(/\D/g, "")}`
        : null
      : rows[0].external_url || null;

  if (!destino) return NextResponse.redirect(origem);

  await registrarCliqueLoja(storeId, alvo);
  // 302: é uma saída pontual, não deve ficar guardada pelo navegador.
  return NextResponse.redirect(destino, 302);
}
