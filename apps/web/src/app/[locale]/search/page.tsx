import { getTranslations, setRequestLocale } from "next-intl/server";
import { search, type SortOption } from "@/lib/search";
import { getActiveBanners } from "@/lib/banners";
import { registrarVisita, registrarBusca } from "@/lib/analytics";
import { getRates } from "@/lib/rates";
import { Link } from "@/i18n/navigation";
import { SearchBox } from "@/components/SearchBox";
import { ProductCard } from "@/components/ProductCard";
import { quedasPorSlug } from "@/lib/quedas";
import { BannerCarousel } from "@/components/BannerCarousel";
import { SearchFilters, buildHref } from "@/components/SearchFilters";
import { Paginacao } from "@/components/Paginacao";
import { FiltrosMobile } from "@/components/FiltrosMobile";

const ORDENACOES: SortOption[] = ["relevance", "price_asc", "price_desc", "stores"];

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    category?: string;
    brand?: string;
    min?: string;
    max?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const q = sp.q ?? "";
  const category = sp.category;

  const t = await getTranslations("search");
  const th = await getTranslations("home");

  // Marcas vêm separadas por "|" na URL (?brand=Apple|Samsung).
  const activeBrands = (sp.brand ?? "").split("|").filter(Boolean);
  const num = (v?: string) => {
    const n = Number(v);
    return v && Number.isFinite(n) ? n : undefined;
  };
  const sort = (ORDENACOES as string[]).includes(sp.sort ?? "") ? (sp.sort as SortOption) : undefined;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const res = await search(q, {
    category,
    brands: activeBrands,
    minPrice: num(sp.min),
    maxPrice: num(sp.max),
    sort,
    page,
  });

  // Medição: a busca conta como visita e o termo é guardado com quantos
  // resultados devolveu — termo com zero resultado vira "buraco de catálogo".
  void registrarVisita("busca", q || "(sem termo)");
  if (q.trim()) void registrarBusca(q, res.total);

  const categoryBanners = category ? await getActiveBanners("category", category) : [];
  const rates = await getRates();
  // Uma consulta só para a página inteira (e não uma por cartão) devolve o
  // selo de queda de cada produto.
  const quedas = await quedasPorSlug(res.hits.map((h) => h.slug));

  // Repassado para montar os links de filtro/página mantendo o resto.
  const urlParams: Record<string, string | undefined> = {
    q: q || undefined,
    category,
    brand: sp.brand,
    min: sp.min,
    max: sp.max,
    sort: sp.sort,
  };

  const sortLabels: Record<SortOption, string> = {
    relevance: t("sortRelevance"),
    price_asc: t("sortPriceAsc"),
    price_desc: t("sortPriceDesc"),
    stores: t("sortStores"),
  };
  const sortAtual: SortOption = sort ?? (q.trim() ? "relevance" : "price_asc");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {categoryBanners.length > 0 && (
        <div className="mb-6">
          <BannerCarousel
            banners={categoryBanners.map((b) => ({
              id: b.id,
              image_url: b.image_url,
              link_url: b.link_url,
              title: b.title,
              is_paid: b.is_paid,
              store_slug: b.store_slug,
            }))}
          />
        </div>
      )}
      <SearchBox initial={q} />

      <h1 className="mt-8 text-xl font-semibold text-slate-900">
        {q ? `${t("resultsFor")} "${q}"` : t("browse")}
        <span className="ml-2 text-sm font-normal text-slate-400">
          ({res.total.toLocaleString(locale)} {t("results")})
        </span>
      </h1>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row">
        <SearchFilters
          labels={{
            filters: t("filters"),
            brand: t("brand"),
            priceRange: t("priceRange"),
            min: t("min"),
            max: t("max"),
            apply: t("apply"),
            clear: t("clear"),
          }}
          brands={res.brands}
          params={urlParams}
          activeBrands={activeBrands}
        />

        <div className="min-w-0 flex-1">
          {/* Ordenação (e, no celular, o botão que abre os filtros) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
            <FiltrosMobile
              labels={{
                filters: t("filters"),
                brand: t("brand"),
                priceRange: t("priceRange"),
                min: t("min"),
                max: t("max"),
                clear: t("clear"),
                showResults: t("showResults", { n: res.total.toLocaleString(locale) }),
              }}
              brands={res.brands}
              params={urlParams}
              activeBrands={activeBrands}
            />
            <span className="text-xs text-slate-500">{t("sort")}:</span>
            {ORDENACOES.map((o) => (
              <Link
                key={o}
                href={buildHref(urlParams, { sort: o })}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  sortAtual === o
                    ? "bg-brand-navy font-medium text-white"
                    : "border border-slate-200 text-slate-600 hover:border-brand-green"
                }`}
              >
                {sortLabels[o]}
              </Link>
            ))}
          </div>

          {res.hits.length === 0 ? (
            <p className="mt-6 text-slate-500">{t("noResults")}</p>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {res.hits.map((hit) => (
                  <ProductCard
                    key={hit.id}
                    hit={hit}
                    locale={locale}
                    fromLabel={th("from") ?? ""}
                    storesLabel={th("stores") ?? ""}
                    rates={rates}
                    quedaPct={quedas.get(hit.slug)}
                  />
                ))}
              </div>

              <Paginacao
                page={res.page}
                pages={res.pages}
                href={(p) => buildHref(urlParams, { page: String(p) })}
                labels={{
                  previous: t("previous"),
                  next: t("next"),
                  pageOf: t("pageOf", { page: res.page, pages: res.pages }),
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
