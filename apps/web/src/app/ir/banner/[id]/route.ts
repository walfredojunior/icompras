import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { registrarCliqueBanner } from "@/lib/analytics";
import { destinoDoBanner, idiomaValido } from "@/lib/bannerDestino";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Clique de banner: conta e encaminha.
//
// Todo banner clicável passa por aqui, inclusive os que levam para dentro do
// próprio site. É o preço de ter o número: sem esta passagem não há como
// responder "quantos cliques meu banner teve?" — pergunta certa de quem paga
// por um. Custa um salto a mais (o mesmo que já acontece nos cliques de loja).
//
// O DESTINO NUNCA VEM DO ENDEREÇO. Só o número do banner vem, e o resto é lido
// do banco: aceitar um "?para=" pronto transformaria o iCompras em trampolim
// para qualquer site (é o golpe do redirecionamento aberto — o link começa com
// icompras.com.py, então parece confiável).
//
// Fica fora de [locale] de propósito: é um redirecionamento, não uma página.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bannerId = Number(id);
  const url = new URL(req.url);
  const origem = url.origin;
  const locale = idiomaValido(url.searchParams.get("loc"));

  if (!Number.isFinite(bannerId) || bannerId <= 0) return NextResponse.redirect(origem);

  const rows = await pool.query(
    `SELECT b.link_url, b.destino_tipo, b.busca, s.slug AS store_slug
       FROM banner b LEFT JOIN store s ON s.id = b.store_id
      WHERE b.id = ? AND b.active = 1
      LIMIT 1`,
    [bannerId],
  );
  if (!rows.length) return NextResponse.redirect(`${origem}/${locale}`);

  const destino = destinoDoBanner(rows[0] as any, locale);
  if (!destino) return NextResponse.redirect(`${origem}/${locale}`);

  await registrarCliqueBanner(bannerId);

  // 302: passagem pontual, não deve ficar guardada pelo navegador — senão o
  // segundo clique não seria contado.
  return NextResponse.redirect(
    destino.href.startsWith("http") ? destino.href : `${origem}${destino.href}`,
    302,
  );
}
