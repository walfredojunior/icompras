import { MeiliSearch } from "meilisearch";
import { pool } from "@icompras/db";

export const PRODUCTS_INDEX = "products";

// Sem chave em dev; host padrão local. Em produção, definir MEILI_MASTER_KEY.
export function client(): MeiliSearch {
  return new MeiliSearch({
    host: process.env.MEILI_HOST ?? "http://127.0.0.1:7700",
    apiKey: process.env.MEILI_MASTER_KEY,
  });
}

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

// Palavras que não devem contar na busca. Sem isso, digitar "fone de ouvido"
// casava o "de" com meio catálogo e trazia teclados como primeiro resultado.
const STOP_WORDS = [
  // português
  "de", "da", "do", "das", "dos", "com", "para", "por", "em", "no", "na", "nos", "nas", "e", "ao", "aos",
  // espanhol (argentinos e paraguaios também acessam)
  "la", "el", "los", "las", "con", "del", "y", "en",
  // inglês
  "the", "of", "for", "with", "and",
];

// Sinônimos: erros de digitação campeões e equivalências pt ↔ es.
// Preferimos sinônimos a "tolerância a erro" agressiva — eles acertam a
// palavra certa em vez de chutar qualquer coisa parecida.
const SYNONYMS: Record<string, string[]> = {
  // grafias erradas comuns
  ifone: ["iphone"], ifhone: ["iphone"], aifone: ["iphone"], iphon: ["iphone"],
  xiomi: ["xiaomi"], xiaomy: ["xiaomi"], sansung: ["samsung"], samsumg: ["samsung"],
  notbook: ["notebook"], noteboock: ["notebook"], macbok: ["macbook"],
  perfune: ["perfume"], purfume: ["perfume"],
  // espanhol → português (o catálogo está em português)
  heladera: ["geladeira"], nevera: ["geladeira"],
  zapatillas: ["tênis", "tenis"], zapatos: ["calçados", "calcados"],
  campera: ["jaqueta"], remera: ["camiseta"], pantalon: ["calça", "calca"],
  auriculares: ["fone", "headset"], audifonos: ["fone", "headset"],
  cargador: ["carregador"], computadora: ["computador"], ordenador: ["computador"],
  pantalla: ["tela", "monitor"], teclado_es: ["teclado"],
  reloj: ["relógio", "relogio"], anteojos: ["óculos", "oculos"], gafas: ["óculos", "oculos"],
  mujer: ["feminino"], hombre: ["masculino"], ninos: ["infantil"],
  celular_es: ["celular"], heladeras: ["geladeira"],
  lavarropas: ["lavadora"], cocina_es: ["cozinha"], juguetes: ["brinquedos"],
  bicicleta_es: ["bicicleta"], mochila_es: ["mochila"], valija: ["mala"],
  // português → espanhol (para quem busca no site em espanhol)
  geladeira: ["heladera"], jaqueta: ["campera"], carregador: ["cargador"],
  relógio: ["reloj"], relogio: ["reloj"], feminino: ["mujer"], masculino: ["hombre"],
};

export async function ensureIndex(): Promise<void> {
  const c = client();
  try {
    const t = await c.createIndex(PRODUCTS_INDEX, { primaryKey: "id" });
    await c.waitForTask(t.taskUid);
  } catch {
    // índice já existe
  }
  const t = await c.index(PRODUCTS_INDEX).updateSettings({
    // A ordem importa: o que casa no nome vale mais que na marca, categoria
    // ou ficha técnica. `specs_text` entra por último de propósito — serve
    // para achar "impressora 58mm" (a medida só existe na ficha, não no
    // nome), sem deixar a ficha competir com o nome na relevância.
    searchableAttributes: ["name", "brand", "category", "specs_text"],
    // A ficha é indexada mas NÃO volta nas respostas: são 8,9 MB de texto que
    // ninguém usa na listagem.
    displayedAttributes: [
      "id", "slug", "name", "brand", "category",
      "image_url", "min_price", "store_count", "colors",
    ],
    filterableAttributes: ["brand", "category", "colors", "min_price"],
    sortableAttributes: ["min_price", "store_count"],
    stopWords: STOP_WORDS,
    synonyms: SYNONYMS,
    // ONDE a palavra aparece no nome pesa mais que a DISTÂNCIA entre as
    // palavras (wordPosition antes de proximity). Isso vale aqui porque o
    // nome do produto sempre começa pelo tipo ("Notebook …", "Memória …"),
    // e o visitante digita o tipo primeiro.
    // Com a ordem padrão, "notebook 16gb" trazia pentes de memória
    // ("Memória … 16GB … Notebook", palavras coladas) antes dos notebooks
    // ("Notebook … Memória 16GB", palavras distantes).
    rankingRules: ["words", "typo", "attributeRank", "wordPosition", "proximity", "sort", "exactness"],
    // Antes: 2 erros já a partir de 5 letras — chutava demais ("tenis" casava
    // com o monitor "Teros", "campera" com "câmera"). Agora 2 erros só em
    // palavras longas, e nenhum erro em números (para 128GB não virar 256GB).
    // disableOnNumbers existe no servidor, mas ainda não no tipo da biblioteca.
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
      disableOnNumbers: true,
    } as unknown as { enabled: boolean },
  });
  await c.waitForTask(t.taskUid);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Reindexa todos os produtos no Meilisearch. Retorna a quantidade. Não fecha o pool.
export async function syncProducts(): Promise<number> {
  await ensureIndex();

  const rows = await pool.query(
    `SELECT p.id, p.slug, p.canonical_name AS name, p.brand, c.slug AS category,
            p.specs, p.primary_image_url AS image_url,
            LEAST(IFNULL(MIN(o.price_usd), p.min_price_usd), IFNULL(p.min_price_usd, MIN(o.price_usd))) AS min_price,
            GREATEST(COUNT(DISTINCT o.store_id), MAX(p.ext_store_count)) AS store_count
     FROM product p
     LEFT JOIN category c ON c.id = p.category_id
     LEFT JOIN product_variant v ON v.product_id = p.id
     LEFT JOIN offer o ON o.variant_id = v.id
     GROUP BY p.id`,
  );

  const colorRows = await pool.query(
    `SELECT v.product_id, GROUP_CONCAT(DISTINCT va.value_label SEPARATOR '||') AS colors
     FROM variant_attribute va JOIN product_variant v ON v.id = va.variant_id
     WHERE va.attr_key = 'color' GROUP BY v.product_id`,
  );
  const colorsById = new Map<number, string[]>(
    colorRows.map((r: any) => [Number(r.product_id), r.colors ? String(r.colors).split("||") : []]),
  );

  // A ficha técnica vira um texto corrido para poder ser buscada:
  // [{k:"Largura do Papel",v:"58mm"}] -> "Largura do Papel 58mm"
  const fichaEmTexto = (specs: unknown): string => {
    if (!specs) return "";
    try {
      const lista = typeof specs === "string" ? JSON.parse(specs) : specs;
      if (!Array.isArray(lista)) return "";
      return lista
        .map((s: { k?: string; v?: string }) => `${s?.k ?? ""} ${s?.v ?? ""}`.trim())
        .filter(Boolean)
        .join(" · ")
        .slice(0, 2000);
    } catch {
      return "";
    }
  };

  const docs = rows.map((r: any) => ({
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    brand: r.brand ?? "",
    category: r.category ?? "",
    specs_text: fichaEmTexto(r.specs),
    image_url: r.image_url ?? null,
    min_price: r.min_price != null ? Number(r.min_price) : null,
    store_count: Number(r.store_count ?? 0),
    colors: colorsById.get(Number(r.id)) ?? [],
  }));

  const task = await client().index(PRODUCTS_INDEX).addDocuments(docs);
  await client().waitForTask(task.taskUid);
  return docs.length;
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

// Aspas dentro do valor quebrariam o filtro do Meilisearch.
function q(v: string): string {
  return `"${v.replace(/"/g, '\\"')}"`;
}

export async function search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const index = client().index<ProductHit>(PRODUCTS_INDEX);
  const perPage = opts.perPage ?? 24;
  const page = Math.max(1, opts.page ?? 1);

  const filters: string[] = [];
  const cats = opts.categories?.length ? opts.categories : opts.category ? [opts.category] : [];
  if (cats.length) filters.push(`category IN [${cats.map(q).join(", ")}]`);
  if (opts.brands?.length) filters.push(`brand IN [${opts.brands.map(q).join(", ")}]`);
  if (opts.minPrice != null) filters.push(`min_price >= ${opts.minPrice}`);
  if (opts.maxPrice != null) filters.push(`min_price <= ${opts.maxPrice}`);

  // Sem termo de busca (navegação por categoria), relevância não significa
  // nada — aí o padrão é o menor preço primeiro.
  const sort = opts.sort ?? (query.trim() ? "relevance" : "price_asc");
  const sortBy =
    sort === "price_asc" ? ["min_price:asc"]
    : sort === "price_desc" ? ["min_price:desc"]
    : sort === "stores" ? ["store_count:desc"]
    : undefined;

  const res = await index.search(query, {
    page,
    hitsPerPage: perPage,
    filter: filters.length ? filters : undefined,
    sort: sortBy,
    facets: ["brand"],
  });

  const dist = (res as unknown as { facetDistribution?: Record<string, Record<string, number>> })
    .facetDistribution?.brand ?? {};
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

// Sugestões para o campo de busca (o "vai completando" enquanto digita).
export async function suggest(query: string, limit = 6): Promise<Array<{ name: string; slug: string }>> {
  if (!query.trim()) return [];
  const res = await client()
    .index<ProductHit>(PRODUCTS_INDEX)
    .search(query, { limit, attributesToRetrieve: ["name", "slug"] });
  return (res.hits as ProductHit[]).map((h) => ({ name: h.name, slug: h.slug }));
}
