import { pool } from "@/lib/db";
import { BarChart3 } from "lucide-react";

// O QUE O ANUNCIANTE RECEBEU PELO QUE PAGOU — no painel da própria loja.
//
// ⚠ POR QUE EXISTE (21/08/2026). Os cliques já eram contados desde sempre
// (`analytics_banner_click`), mas ninguém via: o dado morria no banco. Sem
// número na mão do cliente, a renovação vira discussão de preço; com número,
// vira conta.
//
// 💡 Mostra também QUANTAS BUSCAS a categoria recebeu no mês — é o argumento
// pronto para vender a categoria seguinte, e explica ao cliente por que uma
// categoria custa mais que outra.

/* eslint-disable @typescript-eslint/no-explicit-any */

const dia = (s: any) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : null);

export async function MeusBanners({ storeId }: { storeId: number }) {
  const banners = await pool.query(
    `SELECT b.id, b.title, b.image_url, b.placement, b.category_slug,
            b.starts_at, b.ends_at, b.active,
            COALESCE(c.cliques, 0) AS cliques30,
            COALESCE(s.buscas, 0) AS buscas30
       FROM banner b
       LEFT JOIN (
         SELECT banner_id, SUM(clicks) AS cliques
           FROM analytics_banner_click
          WHERE day > CURDATE() - INTERVAL 30 DAY
          GROUP BY banner_id
       ) c ON c.banner_id = b.id
       LEFT JOIN (
         SELECT term, SUM(searches) AS buscas
           FROM analytics_search
          WHERE day > CURDATE() - INTERVAL 30 DAY
          GROUP BY term
       ) s ON s.term = b.category_slug
      WHERE b.store_id = ?
      ORDER BY b.ends_at IS NULL DESC, b.ends_at DESC, b.id DESC`,
    [storeId],
  );

  // Loja sem banner nenhum não ganha uma caixa vazia na tela: quem nunca
  // comprou não precisa saber que existe um relatório do que não tem.
  if (!banners.length) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const noAr = (b: any) =>
    b.active &&
    (!b.starts_at || String(b.starts_at).slice(0, 10) <= hoje) &&
    (!b.ends_at || String(b.ends_at).slice(0, 10) >= hoje);

  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <BarChart3 className="h-4 w-4 text-slate-400" />
        Seus anúncios
      </h2>
      <p className="mb-3 text-xs text-slate-500">Cliques dos últimos 30 dias.</p>

      <ul className="space-y-2">
        {banners.map((b: any) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image_url} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-800">{b.title || "Anúncio"}</p>
              <p className="text-[11px] text-slate-400">
                {b.category_slug ? `categoria ${b.category_slug}` : "página inicial"}
                {dia(b.starts_at) || dia(b.ends_at)
                  ? ` · ${dia(b.starts_at) ?? "início livre"} a ${dia(b.ends_at) ?? "sem término"}`
                  : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <div className="text-right">
                <p className="text-base font-bold text-slate-900">{Number(b.cliques30)}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">cliques</p>
              </div>
              {Number(b.buscas30) > 0 && (
                <div className="text-right">
                  <p className="text-base font-bold text-slate-900">{Number(b.buscas30)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">buscas na categoria</p>
                </div>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  noAr(b)
                    ? "bg-brand-green-light text-brand-green-dark"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {noAr(b) ? "no ar" : "fora do ar"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
