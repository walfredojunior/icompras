import { unstable_cache } from "next/cache";
import { pool } from "./db";
import { toUsd } from "./money";
import type { Rates } from "./rates";
import type { ProductHit } from "./search";

// CINCO MINUTOS DE VALIDADE — escolha do dono, perguntado e respondido em
// 06/08/2026: "sim, um preço desatualizado por 5 minutos é aceitável".
//
// A pergunta veio de uma medição: a Cloudflare devolve `cf-cache-status:
// DYNAMIC` em TODAS as páginas, ou seja, cada visitante atravessa até o banco.
//
// ⚠ Por que aqui, e não guardando a página inteira na borda: a página de
// produto tem partes de CADA visitante — se está logado, se o produto é
// favorito dele, e o registro da visita. HTML guardado na borda mostraria o
// favorito de um para outro e apagaria a estatística. Guardando os DADOS o
// ganho é quase o mesmo e nada disso quebra: login e favorito seguem ao vivo.
//
// `unstable_cache` e não a diretiva `use cache` (que é o caminho novo do
// Next 16) porque `use cache` exige ligar `cacheComponents` no next.config, o
// que muda o comportamento do site INTEIRO — mudança grande demais para
// produção só por isto. Ver node_modules/next/dist/docs/.../use-cache.md.
const VALIDADE = { revalidate: 300 };

export interface ProductStore {
  id: number;
  slug: string;
  name: string;
  logo: string | null;
  phone: string | null; // WhatsApp da loja, quando o coletor capturou
  priceUsd: number | null; // preço só quando vem de uma oferta real (loja via API)
  // Dados da oferta daquela loja: cada uma anuncia a sua variação.
  offerTitle: string | null;
  offerCode: string | null;
  offerImage: string | null;
  /** Id da oferta mais barata desta loja — usado no redirecionamento contado. */
  offerId: number | null;
  /** Endereço DAQUELE produto no site DA loja. Null quando ainda não coletado. */
  storeUrl: string | null;
}

export interface ProductDetail {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  colors: string[];
  minUsd: number | null;
  stores: ProductStore[];
  specs: Array<{ k: string; v: string }>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function buscarProductDetail(slug: string): Promise<ProductDetail | null> {
  const prod = await pool.query(
    "SELECT id, slug, canonical_name AS name, brand, primary_image_url AS image_url, min_price_usd, specs FROM product WHERE slug = ? LIMIT 1",
    [slug],
  );
  if (!prod.length) return null;
  const p = prod[0];
  const pid = Number(p.id);

  let specs: Array<{ k: string; v: string }> = [];
  if (p.specs) {
    try {
      specs = typeof p.specs === "string" ? JSON.parse(p.specs) : p.specs;
    } catch {
      specs = [];
    }
  }

  const colorRows = await pool.query(
    "SELECT DISTINCT va.value_label FROM variant_attribute va JOIN product_variant v ON v.id = va.variant_id WHERE v.product_id = ? AND va.attr_key = 'color'",
    [pid],
  );
  const colors = colorRows.map((r: any) => r.value_label);

  // Lojas com oferta real (via API) — têm preço.
  // Cada loja aparece UMA vez, com os dados da oferta MAIS BARATA dela.
  //
  // O truque do GROUP_CONCAT ordenado por preço + SUBSTRING_INDEX pega "o
  // primeiro da lista ordenada", que é a oferta mais barata daquela loja.
  //
  // ⚠ O `COALESCE(..., '')` não é enfeite: **`GROUP_CONCAT` PULA OS NULOS**.
  // Sem ele, se a oferta mais barata não tem título, o primeiro item da lista
  // de títulos passa a ser o da SEGUNDA oferta — e a linha mistura o preço de
  // uma com o título de outra. Com o `COALESCE` o nulo vira posição vazia e
  // todas as colunas continuam alinhadas. O `|| null` na leitura devolve o
  // vazio para nulo. (Achado em 06/08/2026, ao somar o link da loja.)
  const offers = await pool.query(
    `SELECT s.id, s.slug, s.name, s.logo_url AS logo, s.phone, MIN(o.price_usd) AS price,
            SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(o.title, '') ORDER BY o.price_usd SEPARATOR 0x1f), 0x1f, 1) AS offer_title,
            SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(o.code, '') ORDER BY o.price_usd SEPARATOR 0x1f), 0x1f, 1) AS offer_code,
            SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(o.image_url, '') ORDER BY o.price_usd SEPARATOR 0x1f), 0x1f, 1) AS offer_image,
            SUBSTRING_INDEX(GROUP_CONCAT(COALESCE(o.store_url, '') ORDER BY o.price_usd SEPARATOR 0x1f), 0x1f, 1) AS offer_store_url,
            SUBSTRING_INDEX(GROUP_CONCAT(o.id ORDER BY o.price_usd SEPARATOR 0x1f), 0x1f, 1) AS offer_id
     FROM offer o JOIN product_variant v ON v.id = o.variant_id JOIN store s ON s.id = o.store_id
     WHERE v.product_id = ? AND o.in_stock = 1 GROUP BY s.id ORDER BY price ASC`,
    [pid],
  );

  // Lojas do agregador (sem preço por loja).
  const scraped = await pool.query(
    "SELECT s.id, s.slug, s.name, s.logo_url AS logo, s.phone FROM product_store ps JOIN store s ON s.id = ps.store_id WHERE ps.product_id = ? ORDER BY s.name",
    [pid],
  );

  const seen = new Set<string>();
  const stores: ProductStore[] = [];
  for (const o of offers) {
    stores.push({
      id: Number(o.id),
      slug: o.slug,
      name: o.name,
      logo: o.logo ?? null,
      phone: o.phone ?? null,
      priceUsd: Number(o.price),
      // `|| null` e nao `?? null`: o COALESCE da consulta troca nulo por vazio
      // para nao desalinhar as colunas, e aqui o vazio volta a ser nulo.
      offerTitle: o.offer_title || null,
      offerCode: o.offer_code || null,
      offerImage: o.offer_image || null,
      offerId: o.offer_id ? Number(o.offer_id) : null,
      storeUrl: o.offer_store_url || null,
    });
    seen.add(o.slug);
  }
  for (const s of scraped) {
    if (!seen.has(s.slug)) {
      stores.push({
        id: Number(s.id),
        slug: s.slug,
        name: s.name,
        logo: s.logo ?? null,
        phone: s.phone ?? null,
        priceUsd: null,
        offerTitle: null,
        offerCode: null,
        offerImage: null,
        offerId: null,
        storeUrl: null,
      });
      seen.add(s.slug);
    }
  }

  const offerMin = offers.length ? Number(offers[0].price) : null;
  const pmin = p.min_price_usd != null ? Number(p.min_price_usd) : null;
  const candidates = [offerMin, pmin].filter((v): v is number => v != null);
  const minUsd = candidates.length ? Math.min(...candidates) : null;

  return {
    id: pid,
    slug: p.slug,
    name: p.name,
    brand: p.brand ?? null,
    image_url: p.image_url ?? null,
    colors,
    minUsd,
    stores,
    specs,
  };
}

// Caminho de migalhas: raiz → subcategoria (nomes no idioma), para navegar de volta.
async function buscarProductBreadcrumb(
  slug: string,
  locale: string,
): Promise<Array<{ slug: string; name: string }>> {
  const rows = await pool.query("SELECT category_id FROM product WHERE slug = ? LIMIT 1", [slug]);
  if (!rows.length || rows[0].category_id == null) return [];
  let catId: number | null = Number(rows[0].category_id);
  const chain: Array<{ slug: string; name: string }> = [];
  let guard = 0;
  while (catId != null && guard++ < 6) {
    const c = await pool.query(
      `SELECT c.slug, c.parent_id, COALESCE(ct.name, c.slug) AS name
       FROM category c LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
       WHERE c.id = ? LIMIT 1`,
      [locale, catId],
    );
    if (!c.length) break;
    chain.unshift({ slug: c[0].slug, name: c[0].name });
    catId = c[0].parent_id != null ? Number(c[0].parent_id) : null;
  }
  return chain;
}

// Produtos relacionados por similaridade (IA / embeddings VECTOR do MariaDB).
//
// ⚠ ESTA FUNÇÃO ERA O GARGALO DO SITE INTEIRO (medido em 06/08/2026).
//
// A página de produto levava 2,5 s com um visitante e 7,5 s com dez — enquanto
// busca e "baixaram de preço" respondiam em 0,26 s. É a página mais importante
// que existe: é nela que o Google deixa o visitante e para onde vai todo clique
// da busca. Dois segundos dos 2,5 eram esta consulta.
//
// A causa: ela comparava o produto com os **226 mil** vetores do catálogo, um
// por um, a cada visita. O índice vetorial (HNSW) não ajuda aqui — ele só entra
// quando o vetor de comparação é uma constante, e aqui ele vem de um JOIN.
//
// E não adianta trocar para o jeito que o índice entende: testado lado a lado,
// a busca indexada (euclidiana) devolvia *acessórios* para um celular — bateria,
// tela, capa, display. A cosseno força bruta devolvia os celulares comparáveis.
// Rápido e errado não serve.
//
// A SAÍDA: manter a cosseno, mas comparar só com a MESMA CATEGORIA. Medido no
// iPhone 14 Pro Max: **os 6 mesmos produtos, na mesma ordem, em 0,085 s no
// lugar de 2,0 s** — 24× mais rápido, porque são 795 candidatos e não 226 mil.
// Faz sentido além do desempenho: produto relacionado de celular é celular.
//
// A rede de segurança abaixo existe para 0,54% do catálogo: 1.218 produtos sem
// categoria e 12 em categorias com menos de 7 itens. Nesses, e só nesses, a
// busca ampla (lenta) ainda roda — melhor uma página lenta do que uma página
// sem sugestão nenhuma.
const SELECT_RELACIONADOS = `p.id, p.slug, p.canonical_name AS name, p.brand, p.primary_image_url AS image_url,
            COALESCE((SELECT MIN(o.price_usd) FROM offer o JOIN product_variant v ON v.id = o.variant_id WHERE v.product_id = p.id AND o.in_stock = 1), p.min_price_usd) AS min_price,
            GREATEST(
              (SELECT COUNT(DISTINCT o.store_id) FROM offer o JOIN product_variant v ON v.id = o.variant_id WHERE v.product_id = p.id AND o.in_stock = 1),
              p.ext_store_count
            ) AS store_count`;

async function buscarRelatedProducts(productId: number, limit = 6): Promise<ProductHit[]> {
  // Caminho normal: só dentro da categoria do produto.
  let rows = await pool.query(
    `SELECT ${SELECT_RELACIONADOS}
     FROM product_embedding e1
     JOIN product p0 ON p0.id = e1.product_id
     JOIN product p ON p.category_id = p0.category_id AND p.id <> p0.id
     JOIN product_embedding e2 ON e2.product_id = p.id
     WHERE e1.product_id = ?
     ORDER BY VEC_DISTANCE_COSINE(e1.embedding, e2.embedding) ASC
     LIMIT ?`,
    [productId, limit],
  );

  // Plano B para quem não tem categoria (ou tem categoria quase vazia).
  if (rows.length < limit) {
    rows = await pool.query(
      `SELECT ${SELECT_RELACIONADOS}
       FROM product_embedding e1
       JOIN product_embedding e2 ON e2.product_id <> e1.product_id
       JOIN product p ON p.id = e2.product_id
       WHERE e1.product_id = ?
       ORDER BY VEC_DISTANCE_COSINE(e1.embedding, e2.embedding) ASC
       LIMIT ?`,
      [productId, limit],
    );
  }

  return rows.map((r: any) => ({
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    brand: r.brand ?? "",
    category: "",
    image_url: r.image_url ?? null,
    min_price: r.min_price != null ? Number(r.min_price) : null,
    store_count: Number(r.store_count ?? 0),
    colors: [],
  }));
}

// O histórico é LIDO do banco (caro) e depois convertido pelo câmbio (barato).
// Só a leitura entra no cache: se o câmbio mudar, o gráfico acompanha na hora,
// porque a conversão continua acontecendo a cada pedido.
const lerHistorico = unstable_cache(
  async (productId: number): Promise<any[]> =>
    pool.query(
      `SELECT h.recorded_at, h.price, h.currency
     FROM offer_price_history h
     JOIN offer o ON o.id = h.offer_id
     JOIN product_variant v ON v.id = o.variant_id
     WHERE v.product_id = ?
     ORDER BY h.recorded_at ASC`,
      [productId],
    ),
  ["produto-historico"],
  VALIDADE,
);

export async function getPriceHistory(
  productId: number,
  rates: Rates,
): Promise<Array<{ day: string; usd: number }>> {
  const rows = await lerHistorico(productId);
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const usd = toUsd(Number(r.price), r.currency, rates);
    const day = new Date(r.recorded_at).toISOString().slice(0, 10);
    byDay.set(day, Math.min(byDay.get(day) ?? Infinity, usd));
  }
  return [...byDay.entries()].map(([day, usd]) => ({ day, usd: Math.round(usd * 100) / 100 }));
}

// As três consultas da página de produto, guardadas por 5 minutos.
// Os nomes exportados são os mesmos de antes — nenhum chamador muda.
export const getProductDetail = unstable_cache(buscarProductDetail, ["produto-detalhe"], VALIDADE);
export const getProductBreadcrumb = unstable_cache(buscarProductBreadcrumb, ["produto-migalhas"], VALIDADE);
export const getRelatedProducts = unstable_cache(buscarRelatedProducts, ["produto-relacionados"], VALIDADE);
