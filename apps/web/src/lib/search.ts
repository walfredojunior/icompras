import { MeiliSearch } from "meilisearch";

export interface ProductHit {
  id: number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  image_url: string | null;
  min_price: number | null;
  store_count: number;
  colors: string[];
}

export type SortOption = "relevance" | "price_asc" | "price_desc" | "stores";

export interface SearchOptions {
  category?: string;
  categories?: string[];
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: SortOption;
  page?: number;
  perPage?: number;
}

export interface SearchResult {
  hits: ProductHit[];
  total: number;
  page: number;
  pages: number;
  brands: Array<{ value: string; count: number }>;
}

function client(): MeiliSearch {
  return new MeiliSearch({
    host: process.env.MEILI_HOST ?? "http://127.0.0.1:7700",
    apiKey: process.env.MEILI_MASTER_KEY,
  });
}

// Aspas dentro do valor quebrariam o filtro do Meilisearch.
function q(v: string): string {
  return `"${v.replace(/"/g, '\\"')}"`;
}

export async function search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const index = client().index<ProductHit>("products");
  const perPage = opts.perPage ?? 24;
  const page = Math.max(1, opts.page ?? 1);

  const filters: string[] = [];
  const cats = opts.categories?.length ? opts.categories : opts.category ? [opts.category] : [];
  if (cats.length) filters.push(`category IN [${cats.map(q).join(", ")}]`);
  if (opts.brands?.length) filters.push(`brand IN [${opts.brands.map(q).join(", ")}]`);
  if (opts.minPrice != null) filters.push(`min_price >= ${opts.minPrice}`);
  if (opts.maxPrice != null) filters.push(`min_price <= ${opts.maxPrice}`);

  // Sem termo digitado (navegação por categoria) relevância não diz nada:
  // aí o padrão passa a ser o menor preço primeiro.
  const sort = opts.sort ?? (query.trim() ? "relevance" : "price_asc");
  const sortBy =
    sort === "price_asc"
      ? ["min_price:asc"]
      : sort === "price_desc"
        ? ["min_price:desc"]
        : sort === "stores"
          ? ["store_count:desc"]
          : undefined;

  const res = await index.search(query, {
    page,
    hitsPerPage: perPage,
    filter: filters.length ? filters : undefined,
    sort: sortBy,
    facets: ["brand"],
  });

  const dist =
    (res as unknown as { facetDistribution?: Record<string, Record<string, number>> }).facetDistribution
      ?.brand ?? {};
  const brands = Object.entries(dist)
    .filter(([value]) => value.trim() !== "")
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const r = res as unknown as { totalHits?: number; totalPages?: number };
  return {
    hits: res.hits as ProductHit[],
    total: r.totalHits ?? res.hits.length,
    page,
    pages: r.totalPages ?? 1,
    brands,
  };
}

export interface Sugestao {
  name: string;
  slug: string;
  image: string | null;
  price: number | null;
  stores: number;
}

// Sugestões do campo de busca. Traz foto e preço para a lista parecer um
// seletor de produto de verdade, e não uma lista de texto.
export async function suggest(query: string, limit = 6): Promise<Sugestao[]> {
  if (!query.trim()) return [];
  const res = await client()
    .index<ProductHit>("products")
    .search(query, {
      limit,
      attributesToRetrieve: ["name", "slug", "image_url", "min_price", "store_count"],
    });
  return (res.hits as ProductHit[]).map((h) => ({
    name: h.name,
    slug: h.slug,
    image: h.image_url ?? null,
    price: h.min_price != null ? Number(h.min_price) : null,
    stores: Number(h.store_count ?? 0),
  }));
}
