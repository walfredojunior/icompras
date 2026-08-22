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
  /**
   * Menor e maior preço DESTE resultado — é o que dá escala à barra de preço.
   *
   * Precisa ser do resultado e não do catálogo inteiro: os preços do site vão
   * de US$ 0,09 a US$ 35.360, então uma barra global seria inútil. Em
   * "celulares" a faixa real é US$ 1,50 a US$ 1.962, e aí a barra faz sentido.
   */
  priceRange: { min: number; max: number } | null;
  /**
   * A categoria dominante do resultado, quando existe uma clara.
   *
   * ⚠ POR QUE ISTO EXISTE (21/08/2026). O banner de categoria só aparecia se a
   * pessoa clicasse no filtro — mas quase ninguém filtra: ela digita
   * "perfumes" (o termo mais buscado do site) e passa direto pelo espaço que
   * está vendido. Isto é o que permite mostrar o banner certo mesmo sem filtro.
   *
   * Nulo quando o resultado está espalhado por várias categorias: banner errado
   * é pior que banner nenhum — o anunciante paga por perfume e aparece em
   * busca de ferramenta.
   */
  categoriaDominante: { slug: string; fatia: number } | null;
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
    // `min_price` entra nas facetas só para o Meilisearch devolver o menor e o
    // maior preço do resultado (facetStats) — é o que dimensiona a barra.
    facets: ["brand", "min_price"],
  });

  const dist =
    (res as unknown as { facetDistribution?: Record<string, Record<string, number>> }).facetDistribution
      ?.brand ?? {};
  const brands = Object.entries(dist)
    .filter(([value]) => value.trim() !== "")
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Faixa de preço do resultado. Vem do Meilisearch já calculada; sem isso a
  // barra de preço não teria como saber onde começa e onde termina.
  const stats =
    (res as unknown as { facetStats?: Record<string, { min: number; max: number }> }).facetStats
      ?.min_price ?? null;
  const priceRange =
    stats && Number.isFinite(stats.min) && Number.isFinite(stats.max) && stats.max > stats.min
      ? { min: Math.floor(stats.min), max: Math.ceil(stats.max) }
      : null;

  // A CATEGORIA DOMINANTE — calculada sobre os PRODUTOS DESTA PÁGINA.
  //
  // ⚠⚠ MEDIDO EM 21/08/2026, e o resultado derrubou minha primeira ideia. Eu
  // usava a faceta do Meilisearch, que conta o resultado INTEIRO. Parecia mais
  // representativo e era pior:
  //
  //            | resultado inteiro (faceta)   | 1ª página
  //   iphone   | capa-para-celular 38%        | celular   100%
  //   celular  | capa-para-celular 26%        | celular   100%
  //   cafeteira| cafeteira 48%                | cafeteira 100%
  //
  // O motivo: "iphone" tem MILHARES de capas e películas no catálogo, que
  // afogam os celulares na contagem total — mas a busca põe os celulares em
  // PRIMEIRO, porque são os mais relevantes. Com a faceta, só "perfume"
  // passava do corte; pela página, todos acertam a categoria certa.
  //
  // 💡 A lição: o que importa é o que a pessoa VÊ, não o que existe no
  // catálogo. O banner acompanha a tela, não o banco.
  let categoriaDominante: { slug: string; fatia: number } | null = null;
  const daPagina = (res.hits as ProductHit[]).map((h) => h.category).filter((c) => c && c.trim());
  if (daPagina.length >= 3) {
    const conta = new Map<string, number>();
    for (const c of daPagina) conta.set(c, (conta.get(c) ?? 0) + 1);
    const [melhorSlug, melhorN] = [...conta.entries()].sort((a, b) => b[1] - a[1])[0];
    const fatia = melhorN / daPagina.length;
    // Maioria simples da página. Abaixo disso o resultado está mesmo
    // espalhado, e mostrar banner seria entregar ao anunciante uma busca que
    // não é a dele. O mínimo de 3 produtos evita que "100% de 1 resultado"
    // valha como maioria.
    if (fatia >= 0.5) categoriaDominante = { slug: melhorSlug, fatia };
  }

  const r = res as unknown as { totalHits?: number; totalPages?: number };
  return {
    hits: res.hits as ProductHit[],
    total: r.totalHits ?? res.hits.length,
    page,
    pages: r.totalPages ?? 1,
    brands,
    priceRange,
    categoriaDominante,
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
