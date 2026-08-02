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
          <span className="text-3xl font-bold text-slate-300">
            {(hit.brand || hit.name).slice(0, 1).toUpperCase()}
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
          <div className="mt-1 text-xs text-slate-400">
            {hit.store_count} {storesLabel}
          </div>
        </div>
      </div>
    </Link>
  );
}
