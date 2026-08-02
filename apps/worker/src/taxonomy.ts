// Árvore de categorias copiada do site de origem.
//
// Antes o iCompras tinha uma árvore inventada (7 grupos, 17 subcategorias) e
// tentava adivinhar em qual delas cada produto caía. A fonte já classifica
// tudo corretamente e o crawler entra numa categoria por vez, então passamos a
// usar a classificação dela: o slug da nossa categoria É o slug da categoria
// de origem, o que torna a ligação produto→categoria direta e sem adivinhação.
import { pool } from "@icompras/db";
import { CATEGORY_I18N } from "./taxonomy-i18n.js";

const BASE = "https://www.comprasparaguai.com.br";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export interface SourceGroup {
  slug: string;
  name: string;
  subs: Array<{ slug: string; name: string }>;
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Lê a página /categorias/ e devolve os grupos com suas subcategorias.
// Ignora links de marca/filtro (contêm "--") e o "Ver todos" do próprio grupo.
export async function fetchSourceTree(): Promise<SourceGroup[]> {
  const res = await fetch(`${BASE}/categorias/`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`categorias/ devolveu ${res.status}`);
  const html = await res.text();

  const body = html.slice(html.indexOf("content content-category"));
  const groups: SourceGroup[] = [];
  for (const bruto of body.split(/(?=<h2 class="content-title)/).slice(1)) {
    // O último grupo colava no rodapé e trazia "termos de uso", "contato" etc.
    // como se fossem categorias — corta antes do rodapé.
    const fimRodape = bruto.search(/container-banners-rodape|footer-main-nav|<footer[\s>]/i);
    const part = fimRodape > 0 ? bruto.slice(0, fimRodape) : bruto;
    const head = part.match(/<a id="([a-z0-9-]+)" href="\/([a-z0-9-]+)\/">([^<]+)<\/a>/);
    if (!head) continue;
    const group: SourceGroup = { slug: head[2], name: unescapeHtml(head[3]).trim(), subs: [] };
    const seen = new Set<string>();
    const re = /href="\/([a-z0-9-]+)\/"[^>]*>\s*(?:<[^>]+>\s*)*([^<]{2,60})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(part))) {
      const slug = m[1];
      const name = unescapeHtml(m[2].replace(/\s+/g, " ")).trim();
      if (slug.includes("--") || slug === group.slug || seen.has(slug) || !name) continue;
      seen.add(slug);
      group.subs.push({ slug, name });
    }
    groups.push(group);
  }
  return groups;
}

// A categoria de um produto sai do próprio nome dele.
// O site de origem nomeia os produtos como "Tipo Marca Modelo" ("Robô de
// Limpeza Xiaomi X20", "Cartão de Memória Kingston 512GB") e o tipo é
// exatamente o nome da categoria — por isso o slug do produto começa pelo
// slug da categoria. Pegamos o MAIOR prefixo que seja uma categoria conhecida,
// para "cartao-de-memoria" não ser confundido com "cartao".
export function categoryFromProductSlug(productSlug: string, categorySlugs: Set<string>): string | null {
  const parts = productSlug.split("-");
  for (let n = parts.length; n > 0; n--) {
    const candidate = parts.slice(0, n).join("-");
    if (categorySlugs.has(candidate)) return candidate;
  }
  return null;
}

// Grava a árvore no banco (idempotente). Devolve quantas categorias existem.
export async function syncTaxonomy(groups: SourceGroup[]): Promise<{ roots: number; subs: number }> {
  const groupSlugs = new Set(groups.map((g) => g.slug));
  const claimed = new Set<string>(groupSlugs); // um slug só pode pertencer a um grupo

  async function upsert(slug: string, name: string, parentId: number | null, position: number): Promise<number> {
    await pool.query(
      `INSERT INTO category (slug, parent_id, position) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE parent_id = VALUES(parent_id), position = VALUES(position)`,
      [slug, parentId, position],
    );
    const [row] = await pool.query("SELECT id FROM category WHERE slug = ?", [slug]);
    const id = Number(row.id);
    const tr = CATEGORY_I18N[slug];
    const names: Record<string, string> = {
      "pt-BR": name,
      es: tr?.es ?? name, // sem tradução: mostra o nome em português
      en: tr?.en ?? name,
    };
    for (const [locale, n] of Object.entries(names)) {
      await pool.query(
        `INSERT INTO category_translation (category_id, locale, name) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        [id, locale, n],
      );
    }
    return id;
  }

  let rootCount = 0;
  let subCount = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const parentId = await upsert(g.slug, g.name, null, gi);
    rootCount++;
    let pos = 0;
    for (const s of g.subs) {
      if (claimed.has(s.slug)) continue; // já pertence a outro grupo
      claimed.add(s.slug);
      await upsert(s.slug, s.name, parentId, pos++);
      subCount++;
    }
  }
  return { roots: rootCount, subs: subCount };
}

// Remove categorias que não existem mais na fonte (ou que entraram por engano,
// como links de rodapé). Só apaga o que está VAZIO e não está sendo usado em
// nenhum banner nem bloco de destaque — nada que apareça no site some daqui.
export async function cleanupTaxonomy(groups: SourceGroup[]): Promise<string[]> {
  const validos = new Set<string>();
  for (const g of groups) {
    validos.add(g.slug);
    for (const s of g.subs) validos.add(s.slug);
  }

  const candidatas = await pool.query(
    `SELECT c.id, c.slug FROM category c
      WHERE NOT EXISTS (SELECT 1 FROM product p WHERE p.category_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM category filho WHERE filho.parent_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM banner b WHERE b.category_slug = c.slug)
        AND NOT EXISTS (SELECT 1 FROM category_block_item i WHERE i.category_id = c.id)`,
  );

  const remover = candidatas.filter((c: { slug: string }) => !validos.has(c.slug));
  for (const c of remover) await pool.query("DELETE FROM category WHERE id = ?", [c.id]);
  return remover.map((c: { slug: string }) => c.slug);
}
