import { Store } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MoneyStack } from "@/components/MoneyStack";
import type { Rates } from "@/lib/rates";
import type { ProductHit } from "@/lib/search";

export function ProductCard({
  hit,
  locale,
  fromLabel,
  storesLabel,
  rates,
  quedaPct,
}: {
  hit: ProductHit;
  locale: string;
  fromLabel: string;
  storesLabel: string;
  rates: Rates;
  /** % de queda nos últimos 7 dias; ausente quando o preço não caiu. */
  quedaPct?: number;
}) {
  return (
    <Link
      href={`/produto/${hit.slug}`}
      className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-brand-green hover:shadow-md"
    >
      {/* Selo de queda. Verde e não vermelho de propósito: aqui preço caindo é
          notícia boa, e vermelho no comércio lê-se como alerta. */}
      {quedaPct ? (
        <span className="absolute left-2 top-2 z-10 rounded-full bg-brand-green px-2 py-0.5 text-xs font-bold text-white shadow-sm">
          −{quedaPct}%
        </span>
      ) : null}
      {/* Fundo branco: as fotos dos produtos vêm com fundo branco, e uma faixa
          cinza aqui desenhava um quadrado visível em volta de cada foto. */}
      <div className="flex h-40 items-center justify-center bg-white">
        {hit.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hit.image_url} alt={hit.name} className="max-h-40 object-contain" />
        ) : (
          // SEM FOTO: a marca do iCompras, nunca a de outro site.
          //
          // Pedido dele em 13/08/2026 — *"se for pra colocar imagem coloca do
          // icompras se não tiver fotos"* — depois de ver o logotipo do
          // Compras Paraguai como foto de 1.636 produtos aqui.
          //
          // Esmaecida de propósito (opacity-40): são ~40 mil produtos sem foto,
          // e a logo em cor cheia nessa quantidade competiria com os produtos
          // que TÊM foto de verdade. A letra da marca continua embaixo, que era
          // o comportamento anterior e ajuda a distinguir um card do outro.
          <span className="flex flex-col items-center gap-1.5 opacity-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="iCompras" className="h-14 w-auto object-contain" />
            <span className="text-lg font-bold text-slate-400">
              {(hit.brand || hit.name).slice(0, 1).toUpperCase()}
            </span>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {hit.brand ? <span className="text-xs uppercase tracking-wide text-slate-400">{hit.brand}</span> : null}
        <span className="mt-1 line-clamp-2 font-medium text-slate-900">{hit.name}</span>

        {hit.colors.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {hit.colors.slice(0, 4).map((c) => (
              <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          <div className="text-xs text-slate-400">{fromLabel}</div>
          <MoneyStack usd={hit.min_price} rates={rates} locale={locale} size="md" />
          {/* QUANTAS LOJAS VENDEM — é o motivo de o site existir, e estava no
              cinza mais apagado da paleta (text-slate-400), do mesmo tom do
              "a partir de", que é só uma legenda. O dono reclamou que "parece
              muito apagado" (06/08/2026).

              Virou selo, e não só texto mais escuro, porque a informação não é
              legenda: é o que diferencia este site de uma loja. O verde da
              marca liga o número à ideia de comparar; a caixinha o separa do
              preço logo acima, para os dois não brigarem. */}
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-1 text-xs font-semibold text-brand-green-dark">
              <Store className="h-3.5 w-3.5" strokeWidth={2.5} />
              {hit.store_count} {storesLabel}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
