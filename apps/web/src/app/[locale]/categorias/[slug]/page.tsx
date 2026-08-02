import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { quedasPorSlug } from "@/lib/quedas";
import { BannerCarousel } from "@/components/BannerCarousel";
import { Link } from "@/i18n/navigation";
import { getCategoryInfo } from "@/lib/categories";
import { search, type SortOption } from "@/lib/search";
import { buildHref } from "@/components/SearchFilters";
import { Paginacao } from "@/components/Paginacao";
import { getActiveBanners } from "@/lib/banners";
import { registrarVisita } from "@/lib/analytics";
import { getRates } from "@/lib/rates";

const ORDENACOES: SortOption[] = ["price_asc", "price_desc", "stores"];

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const info = await getCategoryInfo(slug, locale);
  if (!info) notFound();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const sort = (ORDENACOES as string[]).includes(sp.sort ?? "") ? (sp.sort as SortOption) : undefined;

  const th = await getTranslations("home");
  const ts = await getTranslations("search");
  const tc = await getTranslations("categories");
  // Agrega os produtos da categoria + suas subcategorias.
  const res = await search("", { categories: info.descendantSlugs, perPage: 48, page, sort });
  const hits = res.hits;
  void registrarVisita("categoria", slug);
  const banners = await getActiveBanners("category", slug);
  const rates = await getRates();
  const quedas = await quedasPorSlug(hits.map((h) => h.slug));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <CategorySidebar locale={locale} activeSlug={slug} />
        <div className="flex-1">
          {banners.length > 0 && (
            <div className="mb-5">
              <BannerCarousel banners={banners.map((b) => ({ id: b.id, image_url: b.image_url, link_url: b.link_url, title: b.title, is_paid: b.is_paid, store_slug: b.store_slug }))} />
            </div>
          )}

          {/* Breadcrumb */}
          <nav className="mb-2 text-sm text-slate-400">
            <Link href="/categorias" className="hover:text-brand-navy">{tc("title")}</Link>
            {info.parent && (
              <>
                {" / "}
                <Link href={`/categorias/${info.parent.slug}`} className="hover:text-brand-navy">{info.parent.name}</Link>
              </>
            )}
          </nav>

          <h1 className="text-2xl font-bold text-slate-900">
            {info.name}{" "}
            <span className="text-sm font-normal text-slate-400">
              ({res.total.toLocaleString(locale)})
            </span>
          </h1>

          {/* Só no celular: a lista lateral não aparece lá, então este botão
              é o caminho para trocar de grupo. */}
          <Link
            href="/categorias"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-green hover:text-brand-green-dark lg:hidden"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {tc("title")}
          </Link>

          {/* Subcategorias (drill-down).
              Só no celular: no computador esta mesma lista já está na barra
              lateral, e mostrar as duas deixava a página repetitiva — num
              grupo como Eletrônicos eram as mesmas 49 subcategorias duas vezes. */}
          {/* Uma faixa só, que rola para o lado: um grupo como Eletrônicos tem
              49 subcategorias e, empilhadas, empurravam as fotos 1.500px para
              baixo — quase duas telas de celular antes do primeiro produto. */}
          {info.children.length > 0 && (
            <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden">
              {info.children.map((ch) => (
                <Link
                  key={ch.slug}
                  href={`/categorias/${ch.slug}`}
                  className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-brand-green hover:text-brand-green-dark"
                >
                  {ch.name}
                </Link>
              ))}
            </div>
          )}

          {/* Ordenação */}
          {res.total > 1 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
              <span className="text-xs text-slate-500">{ts("sort")}:</span>
              {ORDENACOES.map((o) => (
                <Link
                  key={o}
                  href={buildHref({ sort: sp.sort }, { sort: o }, `/categorias/${slug}`)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    (sort ?? "price_asc") === o
                      ? "bg-brand-navy font-medium text-white"
                      : "border border-slate-200 text-slate-600 hover:border-brand-green"
                  }`}
                >
                  {o === "price_asc" ? ts("sortPriceAsc") : o === "price_desc" ? ts("sortPriceDesc") : ts("sortStores")}
                </Link>
              ))}
            </div>
          )}

          {/* Produtos */}
          <div className="mt-6">
            {hits.length === 0 ? (
              <p className="text-slate-500">{ts("noResults")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {hits.map((hit) => (
                  <ProductCard
                    key={hit.id}
                    hit={hit}
                    locale={locale}
                    fromLabel={th("from")}
                    storesLabel={th("stores")}
                    rates={rates}
                    quedaPct={quedas.get(hit.slug)}
                  />
                ))}
              </div>
            )}

            <Paginacao
              page={res.page}
              pages={res.pages}
              href={(p) => buildHref({ sort: sp.sort }, { page: String(p) }, `/categorias/${slug}`)}
              labels={{
                previous: ts("previous"),
                next: ts("next"),
                pageOf: ts("pageOf", { page: res.page, pages: res.pages }),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
