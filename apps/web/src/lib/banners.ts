import { pool } from "./db";

export interface Banner {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
  placement: string;
  category_slug: string | null;
  is_paid: number;
  active: number;
  store_id?: number | null;
  store_name?: string | null;
  /** Endereço da loja aqui no iCompras — vira o destino quando o banner aponta para ela. */
  store_slug?: string | null;
  /** busca | marca | loja | link | nenhum | auto (ver lib/bannerDestino.ts). */
  destino_tipo?: string | null;
  /** Termo da busca pronta, ou o nome da marca. */
  busca?: string | null;
  /** Cliques nos últimos 30 dias (só no painel). */
  cliques30?: number;
  /** Período contratado. Nulo dos dois lados = sempre no ar. */
  starts_at?: string | null;
  ends_at?: string | null;
  position?: number;
  /** Onde na página o banner de categoria aparece: topo, meio ou fim. */
  slot?: "topo" | "meio" | "fim" | null;
  /** Em que pedido este banner foi lançado — nulo se ainda não foi cobrado. */
  pedido_numero?: string | null;
  pedido_valor?: number | null;
  /** Cidade — usada pelos restaurantes de "Onde comer". */
  cidade?: string | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Banners ativos de um "lugar" (home_hero, ou category de um slug), respeitando o período.
export async function getActiveBanners(
  placement: string,
  categorySlug?: string,
  slot?: "topo" | "meio" | "fim",
): Promise<Banner[]> {
  const params: any[] = [placement];
  // Colunas prefixadas com b. desde o começo: agora há um JOIN com store e
  // "active" sem dono seria ambíguo.
  let where =
    "b.placement = ? AND b.active = 1 AND (b.starts_at IS NULL OR b.starts_at <= NOW()) AND (b.ends_at IS NULL OR b.ends_at >= NOW())";
  if (placement === "category") {
    where += " AND b.category_slug = ?";
    params.push(categorySlug ?? "");
    if (slot) {
      // ⚠ `COALESCE(b.slot,'topo')`: banner criado antes de 21/08/2026 não tem
      // espaço definido e aparece no topo, que é onde ele aparecia. Sem isto,
      // esses banners sumiriam da tela ao ganharmos os três espaços.
      where += " AND COALESCE(b.slot, 'topo') = ?";
      params.push(slot);
    }
  }
  // O slug da loja vem junto: é o destino quando o banner aponta para a loja.
  // destino_tipo e busca decidem o resto (ver lib/bannerDestino.ts).
  return pool.query(
    `SELECT b.id, b.title, b.image_url, b.link_url, b.destino_tipo, b.busca,
            b.placement, b.category_slug, b.slot, b.cidade, b.is_paid, b.store_id, s.slug AS store_slug
       FROM banner b
       LEFT JOIN store s ON s.id = b.store_id
      WHERE ${where}
      ORDER BY b.position, b.id DESC`,
    params,
  );
}

// Todos os banners (para o admin), com o nome da loja e os cliques do mês.
export async function getAllBanners(): Promise<Banner[]> {
  return pool.query(
    `SELECT b.id, b.title, b.image_url, b.link_url, b.destino_tipo, b.busca,
            b.placement, b.category_slug, b.slot, b.cidade, b.is_paid, b.active, b.position,
            b.starts_at, b.ends_at,
            b.store_id, s.name AS store_name, s.slug AS store_slug,
            COALESCE(c.cliques, 0) AS cliques30,
            v.numero AS pedido_numero, v.valor AS pedido_valor
     FROM banner b
     LEFT JOIN store s ON s.id = b.store_id
     LEFT JOIN (
       SELECT banner_id, SUM(clicks) AS cliques
         FROM analytics_banner_click
        WHERE day > CURDATE() - INTERVAL 30 DAY
        GROUP BY banner_id
     ) c ON c.banner_id = b.id
     LEFT JOIN (
       -- O item de venda deste banner, se houver. É o que permite mostrar
       -- "no ar mas não cobrado" na lista — o buraco que ele apontou.
       SELECT i.banner_id, MIN(p.numero) AS numero, SUM(i.valor) AS valor
         FROM pedido_item i JOIN pedido p ON p.id = i.pedido_id
        WHERE i.banner_id IS NOT NULL
        GROUP BY i.banner_id
     ) v ON v.banner_id = b.id
     ORDER BY b.placement, b.position, b.id DESC`,
  );
}

// Marcas do catálogo, para a lista de sugestão do banner "por marca".
//
// Vêm do banco e não do Meilisearch de propósito: o valor precisa ser
// EXATAMENTE o mesmo texto que está indexado, senão o filtro `brand IN [...]`
// não casa e o banner leva a uma página vazia.
export async function getMarcas(limite = 800): Promise<Array<{ marca: string; produtos: number }>> {
  const rows = await pool.query(
    `SELECT brand, COUNT(*) AS n
       FROM product
      WHERE brand IS NOT NULL AND brand <> ''
      GROUP BY brand
      ORDER BY n DESC
      LIMIT ?`,
    [limite],
  );
  return rows.map((r: any) => ({ marca: String(r.brand), produtos: Number(r.n) }));
}

export interface FeaturedProduct {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  min_price: number | null;
}

export async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  return pool.query(
    `SELECT p.id, p.slug, p.canonical_name AS name, p.brand, p.primary_image_url AS image_url,
            MIN(o.price_usd) AS min_price
     FROM featured_product f
     JOIN product p ON p.id = f.product_id
     LEFT JOIN product_variant v ON v.product_id = p.id
     LEFT JOIN offer o ON o.variant_id = v.id AND o.in_stock = 1
     -- ⚠ O PERÍODO MANDA (22/08/2026). Antes não havia data nenhuma: destaque
     -- ligado ficava no ar até alguém lembrar de desligar. Vendido por um mês,
     -- entregue para sempre. Sem data continua valendo "sempre", que é o caso
     -- dos destaques do próprio site.
     WHERE (f.starts_at IS NULL OR f.starts_at <= NOW())
       AND (f.ends_at IS NULL OR f.ends_at >= NOW())
     GROUP BY p.id, f.position
     ORDER BY f.position, p.id`,
  );
}

/**
 * O banner que ocupa uma categoria num período — ou nulo, se estiver livre.
 *
 * ⚠ A EXCLUSIVIDADE É POR PERÍODO, NÃO POR CATEGORIA (decisão de 21/08/2026).
 * Uma trava do tipo "nunca dois banners em perfume" impediria vender OUTUBRO
 * enquanto o de setembro está no ar — e vender com antecedência é justamente
 * o que dá previsibilidade. Aqui só conflita quem se SOBREPÕE no tempo.
 *
 * 💡 A regra de sobreposição é `(inicioA <= fimB) E (fimA >= inicioB)`, com
 * data vazia valendo "sem limite": sem início = desde sempre, sem fim = para
 * sempre. Por isso um banner sem datas conflita com qualquer outro da mesma
 * categoria — ele ocupa o espaço o tempo todo.
 *
 * `ignorarId` existe para a edição: ao mexer num banner, ele não pode
 * conflitar consigo mesmo.
 */
export async function categoriaOcupadaPor(
  categorySlug: string,
  inicio: string | null,
  fim: string | null,
  ignorarId?: number,
  slot: "topo" | "meio" | "fim" = "topo",
): Promise<Banner | null> {
  // ⚠ A EXCLUSIVIDADE É POR ESPAÇO (21/08/2026). Antes era por categoria
  // inteira; com topo, meio e fim, cada categoria virou TRÊS espaços vendáveis
  // e independentes. Loja A pode comprar o topo de perfume e loja B o meio, no
  // mesmo mês, sem conflito.
  const params: any[] = [categorySlug, slot];
  let sql =
    `SELECT b.id, b.title, b.image_url, b.placement, b.category_slug, b.slot, b.is_paid,
            b.starts_at, b.ends_at, b.store_id, s.name AS store_name
       FROM banner b
       LEFT JOIN store s ON s.id = b.store_id
      WHERE b.placement = 'category' AND b.category_slug = ?
        AND COALESCE(b.slot, 'topo') = ?`;
  if (ignorarId) {
    sql += " AND b.id <> ?";
    params.push(ignorarId);
  }
  // Sobreposição de períodos. COALESCE traduz "sem data" para os extremos.
  sql += " AND COALESCE(b.starts_at, '1000-01-01') <= COALESCE(?, '9999-12-31')";
  params.push(fim);
  sql += " AND COALESCE(b.ends_at, '9999-12-31') >= COALESCE(?, '1000-01-01')";
  params.push(inicio);
  sql += " ORDER BY b.starts_at IS NULL DESC, b.starts_at LIMIT 1";

  const linhas = await pool.query(sql, params);
  return linhas[0] ?? null;
}

/**
 * Data do banco em dd/mm/aaaa.
 *
 * ⚠ NÃO usar `String(valor).slice(0, 10)`: o driver do MariaDB devolve um
 * objeto Date para colunas DATE/DATETIME, e `String(...)` dele vira
 * "Wed Sep 30 2026 ..." — o corte em 10 caracteres entregava "Wed Sep 30" na
 * mensagem de erro que o dono lê. Visto em 21/08/2026, ao testar a trava.
 */
export function dataBR(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()}`;
}
