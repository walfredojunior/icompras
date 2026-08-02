import { Link } from "@/i18n/navigation";
import { MoneyStack } from "@/components/MoneyStack";
import type { Rates } from "@/lib/rates";
import type { ProductStore } from "@/lib/products";

export function StoresList({
  stores,
  rates,
  locale,
  seeStore,
}: {
  stores: ProductStore[];
  rates: Rates;
  locale: string;
  seeStore: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <ul className="divide-y divide-slate-100">
        {stores.map((s) => (
          <li key={s.slug} className="flex items-center gap-4 px-4 py-3">
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo} alt={s.name} className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <Link href={`/loja/${s.slug}`} className="flex-1 font-medium text-slate-800 hover:text-brand-navy">
              {s.name}
            </Link>
            <div className="text-right">
              {s.priceUsd != null ? (
                <MoneyStack usd={s.priceUsd} rates={rates} locale={locale} size="sm" />
              ) : (
                <Link href={`/loja/${s.slug}`} className="text-xs font-medium text-brand-navy hover:underline">
                  {seeStore} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
