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
// Manda o visitante adiante.
//
// Endereço INTERNO vai RELATIVO ("/pt-BR/search?..."), e isso é importante: o
// site roda atrás da Cloudflare e do nginx, então `req.url` mostra o endereço
// que o app enxerga de dentro (127.0.0.1:3000) e NÃO o que a pessoa digitou.
// Montar o destino com essa origem mandava todo mundo para
// "https://localhost:3000/..." — foi exatamente o que quebrou em produção.
// Endereço relativo o navegador resolve contra a barra de endereços, que é o
// domínio de verdade; e não depende de nenhum cabeçalho de proxy estar certo.
//
// 302: passagem pontual, não deve ficar guardada pelo navegador — senão o
// segundo clique não seria contado.
function seguir(destino: string): NextResponse {
  return new NextResponse(null, { status: 302, headers: { Location: destino } });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bannerId = Number(id);
  const locale = idiomaValido(new URL(req.url).searchParams.get("loc"));
  const casa = `/${locale}`;

  if (!Number.isFinite(bannerId) || bannerId <= 0) return seguir(casa);

  const rows = await pool.query(
    `SELECT b.link_url, b.destino_tipo, b.busca, s.slug AS store_slug
       FROM banner b LEFT JOIN store s ON s.id = b.store_id
      WHERE b.id = ? AND b.active = 1
      LIMIT 1`,
    [bannerId],
  );
  if (!rows.length) return seguir(casa);

  const destino = destinoDoBanner(rows[0] as any, locale);
  if (!destino) return seguir(casa);

  await registrarCliqueBanner(bannerId);
  return seguir(destino.href);
}
