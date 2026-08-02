import { ProductCard } from "@/components/ProductCard";
import type { ProductHit } from "@/lib/search";
import type { Rates } from "@/lib/rates";

export function RelatedProducts({
  items,
  locale,
  rates,
  title,
  fromLabel,
  storesLabel,
}: {
  items: ProductHit[];
  locale: string;
  rates: Rates;
  title: string;
  fromLabel: string;
  storesLabel: string;
}) {
  if (!items.length) return null;

  return (
    <section className="mt-14">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((hit) => (
          <ProductCard
            key={hit.id}
            hit={hit}
            locale={locale}
            rates={rates}
            fromLabel={fromLabel}
            storesLabel={storesLabel}
          />
        ))}
      </div>
    </section>
  );
}
