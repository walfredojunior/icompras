import "../env.js";
import { pool } from "@icompras/db";
import { processPriceList } from "../ingest.js";
import type { PriceListItem } from "@icompras/core";

const BASE = "https://www.comprasparaguai.com.br";
const UA = "iCompras-SeedBot/0.1 (catalogo inicial; respeitando robots e rate-limit)";

// Categoria do comprasparaguai -> nossa categoria.
const CATEGORY_MAP: Record<string, string> = {
  celular: "celulares",
  notebook: "informatica",
  informatica: "informatica",
  eletronicos: "eletronicos",
  perfume: "beleza",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es,pt;q=0.8" } });
    if (!res.ok) {
      console.log(`  (HTTP ${res.status}) ${url}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.log(`  (falha de rede) ${url}`);
    return null;
  }
}

function extractProductPaths(html: string, prefix: string): string[] {
  const set = new Set<string>();
  const re = /href="(\/[a-z0-9-]+_\d+\/)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    // Só produtos da própria categoria: o slug começa com o nome dela (ex.: /celular-...).
    if (m[1].startsWith(`/${prefix}-`)) set.add(m[1]);
  }
  return [...set];
}

function metaContent(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

function metaDescription(html: string): string {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

// Preço confiável = "a partir de US$ X" da descrição do próprio produto.
// Se o produto não tem ofertas ("em 0 lojas"), não há preço → retorna null (produto pulado).
function parsePrice(html: string): number | null {
  const m = metaDescription(html).match(/a partir de\s*US\$\s*([\d.]+,\d{2})/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : null;
}

async function ensureSeedStore(): Promise<number> {
  const existing = await pool.query("SELECT id FROM store WHERE slug = 'comprasparaguai-seed' LIMIT 1");
  if (existing.length) return Number(existing[0].id);
  const res = await pool.query(
    `INSERT INTO store (slug, name, status, source, external_url)
     VALUES ('comprasparaguai-seed', 'Catálogo (seed)', 'active', 'scraped', ?)`,
    [BASE],
  );
  return Number(res.insertId);
}

async function main(): Promise<void> {
  const catArg = process.argv[2] ?? "celular";
  const limit = Number(process.argv[3] ?? 5);
  const ourCategory = CATEGORY_MAP[catArg];

  console.log(`Seed: categoria "${catArg}" (limite ${limit})`);
  const listing = await fetchText(`${BASE}/${catArg}/`);
  if (!listing) {
    console.error("Não consegui buscar a listagem.");
    process.exit(1);
  }

  const paths = extractProductPaths(listing, catArg).slice(0, limit);
  console.log(`${paths.length} produto(s) na listagem. Baixando detalhes (pausa de 1,5s)...`);

  const items: PriceListItem[] = [];
  for (const path of paths) {
    await sleep(1500);
    const html = await fetchText(BASE + path);
    if (!html) continue;

    let name = metaContent(html, "og:title") ?? path;
    name = name.split("|")[0].replace(/\s+/g, " ").trim().slice(0, 200);
    const image = metaContent(html, "og:image");
    const price = parsePrice(html);
    const idMatch = path.match(/_(\d+)\/$/);
    const externalId = idMatch ? `cp-${idMatch[1]}` : path;

    if (!price) {
      console.log(`  (sem preço) ${name}`);
      continue;
    }
    console.log(`  ${name} — US$ ${price}`);
    items.push({
      external_id: externalId,
      name,
      category: ourCategory,
      price,
      currency: "USD",
      url: BASE + path,
      image_url: image ?? undefined,
      in_stock: true,
    });
  }

  if (!items.length) {
    console.log("Nenhum item com preço para inserir.");
    await pool.end();
    return;
  }

  const storeId = await ensureSeedStore();
  const result = await processPriceList({ storeId, items, source: "scraped" });
  console.log("Seed concluído:", result);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
