import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { search, type SortOption } from "@/lib/search";
import { cortar } from "@/lib/seo";
import { getActiveBanners } from "@/lib/banners";
import { EspacoDeBanner } from "@/components/EspacoDeBanner";
import { registrarVisita, registrarBusca } from "@/lib/analytics";
import { getRates } from "@/lib/rates";
import { Link } from "@/i18n/navigation";
import { SearchBox } from "@/components/SearchBox";
import { ProductCard } from "@/components/ProductCard";
import { quedasPorSlug } from "@/lib/quedas";
import { SearchFilters, buildHref } from "@/components/SearchFilters";
import { Paginacao } from "@/components/Paginacao";
import { FiltrosMobile } from "@/components/FiltrosMobile";
import { numeroLocal } from "@/lib/format";

const ORDENACOES: SortOption[] = ["relevance", "price_asc", "price_desc", "stores"];

// A BUSCA FICA DE FORA DO ÍNDICE — de propósito.
//
// Cada texto digitado gera um endereço novo, então são infinitas páginas
// possíveis, quase todas repetindo produtos que já têm página própria. O
// Google chama isso de "resultado de busca dentro do site" e desaconselha
// indexar. `follow` continua ligado: ele segue os links dos produtos, só não
// guarda esta página.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { q } = await searchParams;
  const t = await getTranslations({ locale, namespace: "seo" });
  const termo = (q ?? "").trim();
  return {
    title: termo ? `${cortar(termo, 60)} — ${t("searchTitle")}` : t("searchTitle"),
    description: t("searchDesc"),
    robots: { index: false, follow: true },
  };
}

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
    /** "banner" quando a busca foi aberta por um clique em banner. */
    de?: string;
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
  //
  // Busca aberta por BANNER não entra nessa conta. A visita é real (a pessoa
  // viu a página), mas o termo não foi procurado por ninguém: contá-lo
  // inventaria uma demanda que só existe porque um banner está no ar, bem no
  // relatório que usamos para descobrir o que falta no catálogo.
  const veioDeBanner = sp.de === "banner";
  void registrarVisita("busca", q || "(sem termo)");
  if (q.trim() && !veioDeBanner) void registrarBusca(q, res.total);

  // O BANNER DA CATEGORIA — inclusive quando a pessoa NÃO filtrou.
  //
  // ⚠ Antes era só `category ? ... : []`: o banner vendido só aparecia para
  // quem clicasse no filtro de categoria. Só que o caminho comum é outro — a
  // pessoa digita "perfumes" (103 buscas no mês, o termo mais procurado do
  // site) e vê a lista inteira sem nunca filtrar. O espaço vendido ficava
  // invisível justamente na busca que mais vale.
  //
  // Sem filtro, a categoria é DEDUZIDA do resultado (ver `categoriaDominante`
  // em lib/search.ts): só vale quando 60% ou mais dos produtos são da mesma
  // categoria. Busca espalhada não mostra banner de ninguém.
  const slugDoBanner = category ?? res.categoriaDominante?.slug;
  // OS TRÊS ESPAÇOS, buscados de uma vez. Cada um é vendido separadamente.
  const [bannersTopo, bannersMeio, bannersFim] = slugDoBanner
    ? await Promise.all([
        getActiveBanners("category", slugDoBanner, "topo"),
        getActiveBanners("category", slugDoBanner, "meio"),
        getActiveBanners("category", slugDoBanner, "fim"),
      ])
    : [[], [], []];
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
      <EspacoDeBanner
        banners={bannersTopo}
        slot="topo"
        totalNaPagina={res.hits.length}
        rotuloPublicidade={t("ad")}
      />
      <SearchBox initial={q} />

      <h1 className="mt-8 text-xl font-semibold text-slate-900">
        {q ? `${t("resultsFor")} "${q}"` : t("browse")}
        <span className="ml-2 text-sm font-normal text-slate-400">
          ({numeroLocal(res.total, locale)} {t("results")})
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
          priceRange={res.priceRange}
          locale={locale}
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
                showResults: t("showResults", { n: numeroLocal(res.total, locale) }),
              }}
              brands={res.brands}
              params={urlParams}
              activeBrands={activeBrands}
              priceRange={res.priceRange}
              locale={locale}
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
              {/* A LISTA, PARTIDA NO MEIO pelo segundo espaço de banner.
                  💡 O corte é em 12 (metade de uma página cheia de 24) e cai
                  numa linha inteira tanto na grade de 2 colunas do celular
                  quanto na de 3 do computador — banner no meio de uma fileira
                  quebrada ficaria torto. */}
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {res.hits.slice(0, 12).map((hit) => (
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

              <EspacoDeBanner
                banners={bannersMeio}
                slot="meio"
                totalNaPagina={res.hits.length}
                rotuloPublicidade={t("ad")}
              />

              {res.hits.length > 12 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {res.hits.slice(12).map((hit) => (
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
              )}

              <EspacoDeBanner
                banners={bannersFim}
                slot="fim"
                totalNaPagina={res.hits.length}
                rotuloPublicidade={t("ad")}
              />

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
