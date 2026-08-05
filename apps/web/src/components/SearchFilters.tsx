import { Link } from "@/i18n/navigation";
import { X } from "lucide-react";
import { buildHref } from "@/lib/urlFiltros";
import { FaixaDePreco } from "./FaixaDePreco";

export interface FilterLabels {
  filters: string;
  brand: string;
  priceRange: string;
  min: string;
  max: string;
  apply: string;
  clear: string;
}

// Monta um link mantendo os parâmetros atuais e trocando só o que mudou.
// Qualquer mudança de filtro volta para a página 1 — senão o visitante cai
// numa página que não existe mais no resultado filtrado.
// Reexportado para as telas que já importavam daqui.
export { buildHref };

export function SearchFilters({
  labels,
  brands,
  params,
  activeBrands,
  priceRange,
  locale,
}: {
  labels: FilterLabels;
  brands: Array<{ value: string; count: number }>;
  params: Record<string, string | undefined>;
  activeBrands: string[];
  /** Menor e maior preço do resultado atual — dá escala à barra. */
  priceRange: { min: number; max: number } | null;
  locale: string;
}) {
  const temFiltro = activeBrands.length > 0 || params.min || params.max;

  // Escondida no celular: lá os filtros viram um painel que sobe de baixo
  // (FiltrosMobile). Empilhada, esta barra ocupava 672px ANTES do primeiro
  // produto — mais de uma tela inteira.
  return (
    <aside className="hidden w-full shrink-0 lg:block lg:w-56">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{labels.filters}</h2>
        {temFiltro && (
          <Link
            href={buildHref(params, { brand: null, min: null, max: null })}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-navy"
          >
            <X className="h-3 w-3" />
            {labels.clear}
          </Link>
        )}
      </div>

      {/* Faixa de preço: duas bolinhas, sem caixas de digitar (decisão do dono
          em 05/08/2026). O valor exato aparece por cima da barra enquanto se
          arrasta, então ninguém fica sem saber o número. */}
      {priceRange && (
        <FaixaDePreco faixa={priceRange} params={params} locale={locale} rotulo={labels.priceRange} />
      )}

      {brands.length > 0 && (
        <div className="mt-6">
          <span className="text-xs font-medium text-slate-600">{labels.brand}</span>
          <ul className="mt-2 space-y-1">
            {brands.map((b) => {
              const marcado = activeBrands.includes(b.value);
              const novas = marcado ? activeBrands.filter((x) => x !== b.value) : [...activeBrands, b.value];
              return (
                <li key={b.value}>
                  <Link
                    href={buildHref(params, { brand: novas.join("|") || null })}
                    className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm transition ${
                      marcado
                        ? "bg-brand-green-light font-medium text-brand-green-dark"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{b.value}</span>
                    <span className="ml-2 shrink-0 text-xs text-slate-400">{b.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
