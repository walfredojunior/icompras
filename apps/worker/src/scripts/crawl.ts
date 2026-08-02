import "../env.js";
import { chromium, type Browser, type Page } from "playwright";
import { pool } from "@icompras/db";
import { syncProducts } from "@icompras/search";
import { getEmbeddingProvider, ingestImageFromUrl } from "@icompras/core";
import { categoryFromProductSlug, fetchSourceTree } from "../taxonomy.js";
import { buildBrandIndex, brandFromName, type BrandIndex } from "../brands.js";
import { parse as parseHtml, type HTMLElement } from "node-html-parser";

const BASE = "https://www.comprasparaguai.com.br";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

// ---------------------------------------------------------------------------
// Robôs paralelos.
//
// CRAWL_WORKERS   quantos robôs existem ao todo
// CRAWL_WORKER_ID qual é este (0, 1, 2…). O robô 0 é o "chefe de turma": só
//                 ele mexe no controle da volta e roda as varreduras do fim.
// CRAWL_RPS       teto de pedidos por segundo somando TODOS os robôs
//
// A pausa de cada robô sai da conta `workers / rps`, então acrescentar robô
// NÃO aumenta a pressão sobre a fonte — só divide melhor o mesmo teto. Com 4
// robôs e 2 pedidos/s, cada um espera 2 segundos entre páginas.
// ---------------------------------------------------------------------------
const WORKERS = Math.max(1, Number(process.env.CRAWL_WORKERS ?? 1));
const WORKER_ID = Math.max(0, Number(process.env.CRAWL_WORKER_ID ?? 0));
const CHEFE = WORKER_ID === 0;
const RPS = Number(process.env.CRAWL_RPS ?? 2);
// CRAWL_DELAY_MS ainda manda, se alguém quiser fixar na mão.
const DELAY = Number(process.env.CRAWL_DELAY_MS ?? Math.round((1000 * WORKERS) / RPS));
// Quanto tempo uma categoria fica reservada antes de outro robô poder assumir.
// Tem que ser bem maior que a categoria mais demorada — hoje há categorias com
// 16 páginas e centenas de produtos.
const RESERVA_MIN = Number(process.env.CRAWL_RESERVA_MIN ?? 90);
// Teto de espera pelo preço que o JavaScript escreve. Medido em 01/08/2026:
// o preço aparece 62-220ms depois do HTML. 3s é folga larga; era 6000 fixos.
const RENDER_WAIT = Number(process.env.CRAWL_RENDER_WAIT_MS ?? 3000);
const MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES ?? 0);
const MAX_PRODUCTS = Number(process.env.CRAWL_MAX_PRODUCTS ?? 0);
const RECRAWL_HOURS = Number(process.env.CRAWL_RECRAWL_HOURS ?? 24);
const MONITOR = process.env.CRAWL_MONITOR === "true";
const CYCLE_MIN = Number(process.env.CRAWL_CYCLE_MIN ?? 180);
const RECYCLE_EVERY = Number(process.env.CRAWL_RECYCLE_EVERY ?? 120);
const DRY = process.argv.includes("--dry");
// Só a varredura pelo mapa do site, sem percorrer categoria nenhuma.
// Serve para recuperar na hora o que ficou para trás, sem esperar a volta.
const SO_MAPA = process.argv.includes("--mapa");
// Só a varredura pelas páginas de marca (a que acha o catálogo de loja única).
const SO_MARCAS = process.argv.includes("--marcas");
// Só processa a fila dos que exigem navegador (útil para testar e para
// esvaziar a fila mais rápido sem esperar o fim da volta).
const SO_FILA = process.argv.includes("--fila");

let stopRequested = false;
// De onde veio o produto que está sendo lido agora — só para saber, na lista
// de espera, por qual caminho ele apareceu.
let origemAtual = "categoria";

// ---------------------------------------------------------------------------
// Navegador: reciclado de tempos em tempos e reerguido se morrer.
// O Chromium acumulava memória ao longo de milhares de páginas até ser morto
// pelo sistema; isso derrubava o processo inteiro e o crawler recomeçava da
// primeira categoria, sem nunca alcançar as últimas.
// ---------------------------------------------------------------------------
let browser: Browser | null = null;
let page: Page | null = null;
let sinceRecycle = 0;

async function launchBrowser(): Promise<void> {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  page = await browser.newPage({ userAgent: UA });
  // Bloqueia imagens/mídia/fontes para ir mais rápido (pegamos as URLs do DOM).
  await page.route("**/*", (route) => {
    const t = route.request().resourceType();
    if (t === "image" || t === "media" || t === "font") route.abort();
    else route.continue();
  });
  sinceRecycle = 0;
}

async function closeBrowser(): Promise<void> {
  const b = browser;
  browser = null;
  page = null;
  try {
    await b?.close();
  } catch {
    /* já estava morto */
  }
}

async function getPage(): Promise<Page> {
  if (!browser || !browser.isConnected() || !page || page.isClosed()) {
    await closeBrowser();
    await launchBrowser();
  }
  return page as Page;
}

async function recycleIfNeeded(): Promise<void> {
  if (++sinceRecycle < RECYCLE_EVERY) return;
  console.log(`  ♻ reciclando navegador (${sinceRecycle} produtos)`);
  await closeBrowser();
  await launchBrowser();
}

// Categorias conhecidas (espelho da árvore da fonte, ver taxonomy.ts).
let categorySlugs = new Set<string>();
let categoryIdBySlug = new Map<string, number>();
async function loadCategories(): Promise<void> {
  const rows = await pool.query("SELECT id, slug FROM category");
  categorySlugs = new Set(rows.map((r: { slug: string }) => r.slug));
  categoryIdBySlug = new Map(rows.map((r: { id: number; slug: string }) => [r.slug, Number(r.id)]));
}
async function ensureCategory(productId: number, catSlug: string): Promise<void> {
  const id = categoryIdBySlug.get(catSlug);
  if (id) {
    await pool.query("UPDATE product SET category_id = ?, source_category = ? WHERE id = ?", [id, catSlug, productId]);
  }
}

// Índice de marcas: aprendido do catálogo inteiro uma vez por volta, para
// que produtos novos já entrem com a marca preenchida (é o que alimenta o
// filtro "Marca" na busca).
let brandIndex: BrandIndex = { contagem: new Map() };
async function loadBrandIndex(): Promise<void> {
  const rows = await pool.query(
    `SELECT p.canonical_name AS name, c.slug AS category
       FROM product p LEFT JOIN category c ON c.id = p.category_id`,
  );
  brandIndex = buildBrandIndex(rows as Array<{ name: string; category: string | null }>);
}

// Lojas-cliente que enviam a própria lista de preços: o scraper as ignora.
let selfManagedSlugs = new Set<string>();
async function loadSelfManaged(): Promise<void> {
  const rows = await pool.query("SELECT slug FROM store WHERE self_managed = 1");
  selfManagedSlugs = new Set(rows.map((r: { slug: string }) => r.slug));
}

// Controle cooperativo (o painel liga/desliga via tabela scrape_control).
async function ctlStart(): Promise<void> {
  await pool.query(
    `INSERT INTO scrape_control (id, state, stop_requested, pid, message, started_at, heartbeat_at)
     VALUES (1, 'running', 0, ?, 'iniciando…', NOW(), NOW())
     ON DUPLICATE KEY UPDATE state = 'running', stop_requested = 0, pid = VALUES(pid),
       message = 'iniciando…', started_at = NOW(), heartbeat_at = NOW()`,
    [process.pid],
  );
}
async function ctlBeat(message: string, state = "running"): Promise<void> {
  // Com vários robôs, o painel mostra quem escreveu por último. Sem o prefixo
  // pareceria que o coletor fica pulando de categoria sem terminar nenhuma.
  const texto = WORKERS > 1 ? `robô ${WORKER_ID + 1}/${WORKERS} · ${message}` : message;
  await pool.query("UPDATE scrape_control SET heartbeat_at = NOW(), message = ?, state = ? WHERE id = 1", [
    texto.slice(0, 250),
    state,
  ]);
}
async function ctlFinish(message: string): Promise<void> {
  await pool.query("UPDATE scrape_control SET state = 'idle', stop_requested = 0, message = ?, heartbeat_at = NOW() WHERE id = 1", [message]);
}
async function ctlShouldStop(): Promise<boolean> {
  const r = await pool.query("SELECT stop_requested FROM scrape_control WHERE id = 1");
  return r.length ? Number(r[0].stop_requested) === 1 : false;
}

// ---------------------------------------------------------------------------
// Progresso por categoria (tabela crawl_category): garante que TODAS as
// categorias tenham a vez. Antes o crawler começava sempre pela primeira e,
// se caísse no meio do caminho, as categorias do fim da lista nunca eram
// visitadas. Agora a ordem é: nunca visitadas primeiro, depois as mais antigas.
// ---------------------------------------------------------------------------
type Cat = { path: string; our: string };

async function catTouch(cat: Cat): Promise<void> {
  await pool.query(
    `INSERT INTO crawl_category (path, our_category, last_started_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE our_category = VALUES(our_category), last_started_at = NOW()`,
    [cat.path, cat.our],
  );
}

async function catDone(cat: Cat, products: number): Promise<void> {
  await pool.query(
    "UPDATE crawl_category SET last_finished_at = NOW(), last_products = ? WHERE path = ?",
    [products, cat.path],
  );
}

// ---------------------------------------------------------------------------
// Volta (ciclo) do coletor.
// Uma volta termina quando TODAS as categorias foram concluídas desde que ela
// começou. Medir assim (e não por um contador do laço) faz o progresso
// sobreviver a um reinício do processo: o que já foi feito continua contando.
// ---------------------------------------------------------------------------
async function cycleStart(total: number): Promise<void> {
  await pool.query(
    `UPDATE scrape_control
        SET cycle_total = ?,
            cycle = GREATEST(cycle, 1),
            cycle_started_at = COALESCE(cycle_started_at, NOW())
      WHERE id = 1`,
    [total],
  );
}

async function cycleDone(): Promise<number> {
  const [r] = await pool.query(
    `SELECT COUNT(*) n FROM crawl_category
      WHERE last_finished_at IS NOT NULL
        AND last_finished_at >= (SELECT COALESCE(cycle_started_at, '1970-01-01') FROM scrape_control WHERE id = 1)`,
  );
  return Number(r.n);
}

// Fecha a volta se todas as categorias já foram: sobe o número (a barra do
// painel troca de cor), guarda quanto demorou e começa a volta seguinte.
async function cycleMaybeClose(total: number): Promise<boolean> {
  if ((await cycleDone()) < total) return false;
  await pool.query(
    `UPDATE scrape_control
        SET cycle = cycle + 1,
            last_cycle_finished_at = NOW(),
            last_cycle_seconds = TIMESTAMPDIFF(SECOND, cycle_started_at, NOW()),
            cycle_started_at = NOW()
      WHERE id = 1`,
  );
  const [r] = await pool.query("SELECT cycle, last_cycle_seconds s FROM scrape_control WHERE id = 1");
  console.log(`\n✓ Volta concluída em ${Math.round(Number(r.s) / 60)} min. Começando a volta nº ${r.cycle}.`);
  await atualizarResumoDiario();
  return true;
}

// Menor preço de cada produto HOJE, numa linha por produto por dia.
//
// Existe para a página de "baixaram de preço" conseguir responder na hora
// "quanto custava há 7 dias" — perguntar isso ao histórico das 82 mil ofertas
// a cada visita seria lento demais.
//
// Roda no começo e no fim de cada volta (a cada ~2,3 horas). Como usa LEAST,
// a linha do dia guarda o MENOR preço visto ao longo do dia inteiro, mesmo que
// o preço suba depois.
//
// Só entra oferta em estoque e vista há pouco: oferta que sumiu da fonte não
// pode continuar puxando o mínimo para baixo e inventando uma pechincha que
// não existe mais.
async function atualizarResumoDiario(): Promise<void> {
  const res = await pool.query(
    `INSERT INTO product_price_daily (product_id, day, min_usd, offers)
     SELECT v.product_id, CURDATE(), MIN(o.price_usd), COUNT(*)
       FROM offer o
       JOIN product_variant v ON v.id = o.variant_id
      WHERE o.price_usd IS NOT NULL
        AND o.in_stock = 1
        AND o.last_seen_at > NOW() - INTERVAL 3 DAY
      GROUP BY v.product_id
     ON DUPLICATE KEY UPDATE
        min_usd = LEAST(product_price_daily.min_usd, VALUES(min_usd)),
        offers  = VALUES(offers)`,
  );
  console.log(`  resumo de preços do dia atualizado (${res.affectedRows} produtos)`);
}

// Põe na tabela toda categoria descoberta, para a fila de trabalho existir
// antes de qualquer robô começar a pedir serviço. Só o chefe faz isso.
async function semearCategorias(cats: Cat[]): Promise<void> {
  for (const c of cats) {
    await pool.query(
      "INSERT IGNORE INTO crawl_category (path, our_category) VALUES (?, ?)",
      [c.path, c.our],
    );
  }
}

// Pede a próxima categoria para este robô.
//
// Duas coisas garantem que dois robôs não peguem a mesma:
//   • a reserva é um UPDATE condicional — quem conseguir mudar a linha ganhou,
//     e o banco resolve o empate; não existe janela entre "ver" e "pegar";
//   • a reserva expira (RESERVA_MIN), então robô que morra no meio não trava
//     a categoria para sempre.
//
// Devolve null quando não sobrou nada para esta volta.
async function reivindicarCategoria(inicioDaVolta: string): Promise<Cat | null> {
  // Candidatas: ainda não concluídas NESTA volta e sem dono ativo.
  // Nunca visitadas primeiro; depois as mais antigas.
  const candidatas = await pool.query(
    `SELECT path, our_category FROM crawl_category
      WHERE (last_finished_at IS NULL OR last_finished_at < ?)
        AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL ? MINUTE)
      ORDER BY last_finished_at IS NOT NULL, last_finished_at
      LIMIT 30`,
    [inicioDaVolta, RESERVA_MIN],
  );
  for (const c of candidatas as Array<{ path: string; our_category: string | null }>) {
    const r = await pool.query(
      `UPDATE crawl_category
          SET claimed_by = ?, claimed_at = NOW(), last_started_at = NOW()
        WHERE path = ?
          AND (last_finished_at IS NULL OR last_finished_at < ?)
          AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL ? MINUTE)`,
      [`r${WORKER_ID}`, c.path, inicioDaVolta, RESERVA_MIN],
    );
    // affectedRows 1 = esta linha era minha. 0 = outro robô chegou primeiro.
    if (Number(r.affectedRows) === 1) return { path: c.path, our: c.our_category || c.path };
  }
  return null;
}

async function orderCategories(cats: Cat[]): Promise<Cat[]> {
  const rows = await pool.query("SELECT path, last_started_at, last_finished_at FROM crawl_category");
  const rank = new Map<string, number>();
  for (const r of rows) {
    // Uma categoria iniciada mas não concluída (queda no meio) vai para o fim
    // da fila desta volta, para não travar as outras — na volta seguinte ela
    // retoma de onde parou, porque os produtos já feitos são pulados.
    const t = r.last_finished_at ?? r.last_started_at;
    rank.set(r.path, t ? new Date(t).getTime() : 0);
  }
  return [...cats].sort((a, b) => (rank.get(a.path) ?? 0) - (rank.get(b.path) ?? 0));
}

const ALL_CATEGORIES = [
  { path: "celular", our: "celular" },
  { path: "notebook", our: "notebook" },
  { path: "perfume", our: "perfume" },
];

// Páginas do site que NÃO são categorias de produto (ignorar na descoberta).
const CATEGORY_DENYLIST = new Set([
  "anuncie", "contato", "busca", "cidades", "categorias", "como-comprar", "compras-cartao",
  "diretrizes-lista-preco", "duvidas-frequentes", "historico-cotacao", "imposto-dolar", "imoveis",
  "lista-desejos", "lojas", "marcas", "minha-area", "mobile", "cadastro", "login", "conta",
  "favoritos", "carrinho", "ajuda", "faq", "blog", "moto",
  // Hubs que NÃO listam produtos: a página só traz os 14 itens do carrossel
  // de "mais buscados" (conferido um a um em 2026-07-31).
  // ATENÇÃO: "games" estava aqui por engano — ela lista 20 jogos por página,
  // com paginação. Ficou meses sem ser coletada por causa disso.
  "eletronicos", "informatica", "lazer-hobby-camping", "futebol",
]);

// Descobre as categorias a percorrer.
// Preferimos a página /categorias/ da fonte, que traz a árvore COMPLETA (mais
// de 500 categorias). O menu da home, usado antes, listava só as ~90 em
// destaque — o resto do catálogo nunca era visitado.
async function discoverCategories(): Promise<Cat[]> {
  try {
    const grupos = await fetchSourceTree();
    const cats: Cat[] = [];
    const vistos = new Set<string>();
    for (const g of grupos) {
      for (const s of g.subs) {
        if (vistos.has(s.slug) || CATEGORY_DENYLIST.has(s.slug)) continue;
        vistos.add(s.slug);
        cats.push({ path: s.slug, our: s.slug });
      }
    }
    if (cats.length >= 20) return cats;
  } catch (e) {
    console.log(`  (falha ao ler a árvore de categorias: ${(e as Error).message})`);
  }
  // Alternativa: os links de listagem da home.
  const html = await fetchText(`${BASE}/`);
  if (!html) return [];
  const set = new Set<string>();
  const re = /href="\/([a-z0-9-]+)\/"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (slug.includes("--") || slug.length < 3 || CATEGORY_DENYLIST.has(slug)) continue;
    set.add(slug);
  }
  return [...set].map((s) => ({ path: s, our: s }));
}

const STOP = new Set([
  "celular", "no", "paraguai", "paraguay", "de", "com", "dual", "chip", "ram", "global",
  "gb", "tb", "4g", "5g", "smartphone", "notebook", "perfume", "eau", "the", "ml",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 180) || "x"
  );
}
function cleanName(s: string): string {
  return (
    s
      .split("|")[0]
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s+no\s+paragua[iy]\s*$/i, "")
      // "Joog Secador PHD-LN1 2400W 220V NA LOJA NEW ZONE" → sem o rabicho.
      //
      // A fonte põe a loja no título das páginas de anúncio único. Se isso
      // entrasse como nome, o mesmo Xbox vendido por três lojas viraria TRÊS
      // produtos no site em vez de um com três preços — o oposto de comparar.
      .replace(/\s+(na\s+loja|en\s+la\s+tienda|at\s+the\s+store)\s+.+$/i, "")
      .trim()
      .slice(0, 250)
  );
}
function tokens(s: string): string[] {
  return s
    .toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !STOP.has(t));
}
function overlap(a: string[], b: string[]): number {
  if (!a.length) return 0;
  const bs = new Set(b);
  return a.filter((t) => bs.has(t)).length / a.length;
}
function parsePrice(s: string): number | null {
  const n = Number(s.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."));
  return isFinite(n) && n > 0 ? n : null;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es,pt;q=0.8" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
// Todos os links de produto da página de listagem.
//
// ANTES exigia que o link começasse com o slug da categoria — e isso fazia
// as categorias de nome composto voltarem VAZIAS: em
// "/shampoo-e-condicionador/" os produtos são "/shampoo-…" e
// "/condicionador-…", nenhum começa com o slug inteiro. Resultado: 377 das
// 514 categorias colhiam zero produto.
//
// Agora pegamos todo link de produto (qualquer-nome_12345). Vem junto um
// punhado de itens dos carrosséis de "mais buscados" do topo, mas isso é
// inofensivo: a categoria de cada produto sai do NOME dele, não da página
// onde foi encontrado, e na visita seguinte eles já são pulados.
// A fonte tem DOIS formatos de endereço de produto, e por meses só líamos um:
//
//   /shampoo-kerastase-...-250ml_52820/          um  "_", código de 5 dígitos
//   /kerastase-acondicionador-...-200ml__4558331/ dois "__", código de 7 dígitos
//
// O padrão antigo era `[a-z0-9-]+_\d+`. Com "__" o `[a-z0-9-]+` para no
// primeiro "_", o "_" casa, e aí o `\d+` esbarra no segundo "_" e falha — sem
// casamento possível. Esses produtos eram literalmente invisíveis: não é que
// fossem ignorados, o link não era nem reconhecido como link de produto.
// Descoberto em 01/08/2026 porque o dono do site insistiu que via Kerastase
// Elixir na fonte e não achava no iCompras. Ele estava certo.
function extractProductPaths(html: string): string[] {
  const set = new Set<string>();
  const re = /href="(\/[a-z0-9-]+_{1,2}\d+\/)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) set.add(m[1]);
  return [...set];
}

interface Extracted {
  name: string | null;
  image: string | null;
  // Cada loja anuncia sua própria variação: título, foto, código e link
  // podem diferir de uma oferta para outra.
  offers: Array<{
    store: string;
    price: string;
    phone: string | null;
    title: string | null;
    code: string | null;
    image: string | null;
    url: string | null;
  }>;
  logos: Record<string, string>;
  specs: Array<{ k: string; v: string }>;
}

// ---------------------------------------------------------------------------
// Leitura RÁPIDA da página do produto, sem navegador.
//
// Descoberta de 2026-07-30: a fonte entrega as ofertas JÁ PRONTAS no HTML —
// não há nenhuma chamada AJAX buscando a lista de lojas. Ou seja, abrir o
// Chromium e esperar 6 segundos era desperdício: um GET simples devolve tudo
// em ~0,25s. Isso é ~30x mais rápido e derruba quase todo o uso de
// processador do coletor.
//
// O navegador continua existindo como PLANO B: se esta leitura não encontrar
// ofertas (mudança no site), caímos no caminho antigo em vez de quebrar.
// ---------------------------------------------------------------------------
function textoDe(el: HTMLElement | null): string {
  return el ? el.text.replace(/\s+/g, " ").trim() : "";
}

async function extractProductFast(url: string): Promise<Extracted | null> {
  const html = await fetchText(url);
  if (!html) return null;
  const raiz = parseHtml(html);

  const meta = (p: string) =>
    raiz.querySelector(`meta[property="${p}"]`)?.getAttribute("content")?.trim() ?? null;
  const name = meta("og:title") ?? textoDe(raiz.querySelector("title"));
  const image = meta("og:image");

  const logos: Record<string, string> = {};
  for (const img of raiz.querySelectorAll("img.store-image")) {
    const n = (img.getAttribute("alt") || img.getAttribute("title") || "").trim();
    const src = img.getAttribute("data-src") || img.getAttribute("src") || "";
    if (n && src && !src.includes("loading-images")) logos[n] = src;
  }

  const offers: Extracted["offers"] = [];
  for (const info of raiz.querySelectorAll(".promocao-item-info")) {
    // O preço fica num bloco acima; sobe alguns níveis até achar.
    let card: HTMLElement | null = info.parentNode as HTMLElement | null;
    for (let k = 0; k < 4 && card && !card.querySelector(".promocao-item-preco-oferta"); k++) {
      card = card.parentNode as HTMLElement | null;
    }
    if (!card) continue;
    const price = textoDe(card.querySelector(".promocao-item-preco-oferta strong"));
    const title = textoDe(info.querySelector(".promocao-item-nome a")) || null;
    const onclick = info.querySelector(".btn-store-redirect")?.getAttribute("onclick") ?? "";
    const adv = onclick.match(/advertiser['"]?\s*:\s*['"]([^'"]+)['"]/);
    const store = adv ? adv[1].trim() : null;
    const href = info.querySelector('a[href*="api.whatsapp.com"]')?.getAttribute("href") ?? "";
    const phone = (href.match(/phone=(\d+)/) || [])[1] ?? null;
    // Código do anúncio ("Código: 147805") e a foto/link daquela variação.
    const code = (textoDe(info.querySelector(".promocao-item-caracteristicas")).match(/(\d{3,})/) || [])[1] ?? null;
    const imgEl = card.querySelector(".promocao-item-img img");
    const img = imgEl?.getAttribute("data-src") || imgEl?.getAttribute("src") || null;
    const linkEl = card.querySelector(".promocao-item-img a") ?? info.querySelector(".promocao-item-nome a");
    const url = linkEl?.getAttribute("href") ?? null;
    if (price && store) {
      offers.push({
        store,
        price,
        phone,
        title,
        code,
        image: img && !img.includes("loading-images") ? img : null,
        url: url ? (url.startsWith("http") ? url : BASE + url) : null,
      });
    }
  }

  // ANÚNCIO DE UMA LOJA SÓ — o outro leiaute de página da fonte.
  //
  // Os produtos de endereço com "__" não têm a lista de lojas concorrentes:
  // são o anúncio de UMA loja, com preço, logo, link para o site dela e
  // WhatsApp. Não têm `.btn-store-redirect` nem `.promocao-item-preco-oferta`,
  // então o laço acima devolve zero e o produto era descartado mesmo depois de
  // encontrado. Os 20 blocos `.promocao-item-info` dessas páginas são o
  // carrossel de "produtos relacionados" do rodapé, não ofertas.
  if (!offers.length) {
    // .header-product-info (e não --price): o bloco --price guarda só o
    // "código: #22778"; o preço é IRMÃO dele, não filho. Errei isso na
    // primeira tentativa e o preço vinha sempre vazio.
    const caixa = raiz.querySelector(".header-product-info");
    // O preço tem DOIS lugares nessas páginas:
    //   1. na caixa do topo — escrito por JavaScript, some no HTML cru
    //   2. em "Preço atual: US$ 75,00", dentro do formulário escondido de
    //      "informar preço incorreto" — esse vem no HTML, sempre
    //
    // Achar o segundo mudou tudo: eu tinha concluído que essas páginas
    // EXIGIAM navegador (2s cada, e uma fila separada só para elas). Com o
    // preço no HTML cru, elas voltam a ser leitura direta de 0,25s — 8 vezes
    // mais rápido, e sem abrir Chromium.
    const precoTxt =
      raiz.text.match(/Pre[çc]o atual:\s*(US\$\s*[\d.,]+)/i)?.[1] ??
      textoDe(caixa).match(/US\$\s*[\d.,]+/)?.[0] ??
      null;
    // O nome da loja vem do logo dela (a mesma imagem que aparece ao lado dos
    // botões); `title`/`alt` trazem o nome limpo.
// Logo da loja: a fonte guarda em DOIS caminhos diferentes —
    // /uploads/loja/ (New Zone) e /fotos/lojas/ (Shopping China). Eu só olhava
    // o primeiro, então metade das lojas aparecia como "sem logo" e o código
    // acabava pegando o logo do próprio Compras Paraguai como se fosse a loja.
    // Foi o dono do site que percebeu. Agora aceito qualquer imagem que esteja
    // numa pasta de loja, seja qual for o caminho.
    const logoLoja = raiz
      .querySelectorAll("img")
      .find((i) => /\/lojas?\//i.test(i.getAttribute("src") || ""));
    const externo = raiz
      .querySelectorAll("a")
      .find((a) => /external_website_advertiser/.test(a.getAttribute("onclick") || ""));
    // A loja sai do logo QUANDO ele existe; senão, do endereço do botão
    // "Ver no site da loja".
    //
    // Boa parte dessas lojas não tem logo cadastrado e a página mostra o do
    // próprio Compras Paraguai — eu lia "Compras Paraguai" como se fosse a
    // loja. Em 6 de 10 produtos da amostra era esse o caso. O domínio do botão
    // (shoppingchina.com.py, cellshop.com…) é a informação confiável.
    const loja =
      (logoLoja?.getAttribute("title") || logoLoja?.getAttribute("alt") || "").replace(/^Logo\s+/i, "").trim() ||
      dominioDoBotao(externo?.getAttribute("href"));
    if (precoTxt && loja) {
      const wpp = raiz.querySelector('a[href*="api.whatsapp.com"]')?.getAttribute("href") ?? "";
      offers.push({
        store: loja,
        price: precoTxt,
        phone: (wpp.match(/phone=(\d+)/) || [])[1] ?? null,
        title: name,
        code: (textoDe(caixa).match(/c[óo]digo:\s*#?(\d{3,})/i) || [])[1] ?? null,
        image,
        url: externo?.getAttribute("href") ?? null,
      });
      const src = logoLoja?.getAttribute("src");
      if (src) logos[loja] = src;
    }
  }

  const specs: Array<{ k: string; v: string }> = [];
  for (const tr of raiz.querySelectorAll("#detalhes table tr")) {
    const tds = tr.querySelectorAll("td");
    if (tds.length >= 2) {
      const k = textoDe(tds[0]);
      const v = textoDe(tds[1]);
      if (k && v) specs.push({ k, v });
    }
  }

  // Só cai para o navegador quando a página não pôde ser lida (sem nome).
  // Produto SEM OFERTA é resposta legítima — abrir o Chromium nesse caso
  // gastava 8 segundos para chegar à mesma conclusão, e era o que ainda
  // mantinha o navegador vivo.
  //
  // EXCEÇÃO: anúncio de loja única (endereço com "__"). Nessas páginas o preço
  // é escrito por JavaScript e não existe no HTML cru, então "sem oferta" aqui
  // não quer dizer nada — devolvo null de propósito para o navegador tentar.
  if (!name) return null;
  // O anúncio de loja única já é lido por completo aqui (nome, preço, loja,
  // logo) — não cai mais para o navegador. Antes eu devolvia null nesse caso
  // porque não tinha achado o preço no HTML cru.
  return { name, image, offers, logos, specs };
}

async function extractProduct(page: Page, url: string): Promise<Extracted> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  // Espera pelo QUE INTERESSA, não pelo relógio.
  //
  // Antes eram 6 segundos fixos para toda página — um chute herdado de quando
  // o navegador era usado para tudo. Cronometrei 6 páginas do tipo lento em
  // 01/08/2026: o preço aparece de 62 a 220 MILISSEGUNDOS depois do HTML
  // carregar. Esperar 6s era jogar fora ~5,8s por produto.
  //
  // Agora sai assim que a lista de lojas OU o preço de loja única existir, com
  // teto curto. Quando o teto estoura, segue mesmo assim: produto sem preço é
  // resposta legítima e a lista de espera cuida dele.
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll(".btn-store-redirect").length > 0 ||
        /US\$\s*[\d.,]+/.test(document.querySelector(".header-product-info")?.textContent || ""),
      { timeout: RENDER_WAIT, polling: 100 },
    )
    .catch(() => {
      /* sem preço nesta visita — segue e deixa a lista de espera reconferir */
    });
  return page.evaluate(() => {
    const name = document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? document.title;
    const image = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;
    const logos: Record<string, string> = {};
    document.querySelectorAll("img.store-image").forEach((img) => {
      const n = (img.getAttribute("alt") || img.getAttribute("title") || "").trim();
      const src = img.getAttribute("data-src") || img.getAttribute("src") || "";
      if (n && src && !src.includes("loading-images")) logos[n] = src;
    });
    const offers: Extracted["offers"] = [];
    document.querySelectorAll(".promocao-item-info").forEach((info) => {
      let card: Element | null = info.parentElement;
      for (let k = 0; k < 4 && card && !card.querySelector(".promocao-item-preco-oferta"); k++) card = card.parentElement;
      if (!card) return;
      const strongEl = card.querySelector(".promocao-item-preco-oferta strong");
      const price = strongEl ? (strongEl.textContent || "").trim() : null;
      const nameEl = info.querySelector(".promocao-item-nome a");
      const title = nameEl ? (nameEl.textContent || "").trim() : null;
      const redirect = info.querySelector(".btn-store-redirect");
      const onclick = redirect ? redirect.getAttribute("onclick") || "" : "";
      const adv = onclick.match(/advertiser['"]?\s*:\s*['"]([^'"]+)['"]/);
      const store = adv ? adv[1].trim() : null;
      const wa = info.querySelector('a[href*="api.whatsapp.com"]');
      const ph = wa ? ((wa.getAttribute("href") || "").match(/phone=(\d+)/) || [])[1] : null;
      const carac = card.querySelector(".promocao-item-caracteristicas");
      const code = ((carac?.textContent || "").match(/(\d{3,})/) || [])[1] ?? null;
      const imgEl = card.querySelector(".promocao-item-img img");
      const src = imgEl ? imgEl.getAttribute("data-src") || imgEl.getAttribute("src") || "" : "";
      const linkEl = card.querySelector(".promocao-item-img a") || info.querySelector(".promocao-item-nome a");
      const href2 = linkEl ? linkEl.getAttribute("href") || "" : "";
      if (price && store) {
        offers.push({
          store,
          price,
          phone: ph ?? null,
          title,
          code,
          image: src && src.indexOf("loading-images") === -1 ? src : null,
          url: href2 ? (href2.indexOf("http") === 0 ? href2 : location.origin + href2) : null,
        });
      }
    });
    // ANÚNCIO DE UMA LOJA SÓ (endereço com "__").
    //
    // Aqui não há lista de lojas concorrentes: é o anúncio de uma loja, com
    // preço, logo e link. E o preço é escrito por JavaScript — não existe no
    // HTML cru —, por isso este leiaute só pode ser lido com o navegador.
    if (!offers.length) {
      // Ver a nota no leitor rápido: --price só tem o código.
      const caixa = document.querySelector(".header-product-info");
      const txt = caixa ? caixa.textContent || "" : "";
      const precoM = txt.match(/US\$\s*[\d.,]+/);
      // Ver a nota no leitor rápido: são dois caminhos de logo, não um.
      const logoLoja = [...document.querySelectorAll("img")].find((i) =>
        /\/lojas?\//i.test(i.getAttribute("src") || ""),
      );
      const ext = [...document.querySelectorAll("a")].find((a) =>
        /external_website_advertiser/.test(a.getAttribute("onclick") || ""),
      );
      // Ver a nota no leitor rápido: sem logo próprio, a loja vem do domínio
      // do botão "Ver no site da loja".
      let dominio = "";
      try {
        dominio = ext ? new URL(ext.getAttribute("href") || "").hostname.replace(/^www\./, "") : "";
      } catch {
        dominio = "";
      }
      const nomeLoja =
        ((logoLoja?.getAttribute("title") || logoLoja?.getAttribute("alt") || "") as string)
          .replace(/^Logo\s+/i, "")
          .trim() || dominio;
      if (precoM && nomeLoja) {
        const wa = document.querySelector('a[href*="api.whatsapp.com"]');
        offers.push({
          store: nomeLoja,
          price: precoM[0],
          phone: wa ? ((wa.getAttribute("href") || "").match(/phone=(\d+)/) || [])[1] ?? null : null,
          title: name,
          code: (txt.match(/c[óo]digo:\s*#?(\d{3,})/i) || [])[1] ?? null,
          image,
          url: ext ? ext.getAttribute("href") : null,
        });
        const s = logoLoja?.getAttribute("src");
        if (s) logos[nomeLoja] = s;
      }
    }

    const specs: Array<{ k: string; v: string }> = [];
    document.querySelectorAll("#detalhes table tr").forEach((tr) => {
      const tds = tr.querySelectorAll("td");
      if (tds.length >= 2) {
        const k = (tds[0].textContent || "").trim();
        const v = (tds[1].textContent || "").trim();
        if (k && v) specs.push({ k, v });
      }
    });
    return { name, image, offers, logos, specs };
  });
}

const catCache = new Map<string, number | null>();
async function getCategoryId(slug: string): Promise<number | null> {
  if (catCache.has(slug)) return catCache.get(slug)!;
  const rows = await pool.query("SELECT id FROM category WHERE slug = ? LIMIT 1", [slug]);
  const id = rows.length ? Number(rows[0].id) : null;
  catCache.set(slug, id);
  return id;
}

// Lojas que passaram a mandar a própria lista de preços pela API.
//
// A partir do momento em que uma loja entra na plataforma, ELA é a dona do
// preço dela — o coletor tem que sair do caminho, senão sobrescreveria o preço
// oficial na volta seguinte, duas horas depois. O campo `store.source` existe
// desde o início do projeto, mas até hoje ninguém o consultava: o coletor
// gravava por cima de qualquer loja.
//
// Carregado uma vez por volta (é uma lista curta e muda raramente).
let lojasDaApi = new Set<number>();
async function carregarLojasDaApi(): Promise<void> {
  const rows = await pool.query("SELECT id FROM store WHERE source = 'api'");
  lojasDaApi = new Set(rows.map((r: { id: number }) => Number(r.id)));
  if (lojasDaApi.size) console.log(`  ${lojasDaApi.size} loja(s) na plataforma — o coletor não mexe no preço delas`);
}

// Domínio do botão "Ver no site da loja" → "shoppingchina.com.py".
function dominioDoBotao(href: string | null | undefined): string {
  if (!href) return "";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Casa um domínio com uma loja que já existe no catálogo.
//
// "shoppingchina.com.py" tem que virar a MESMA loja que o slug
// "shopping-china" que já tem 5.883 produtos — senão o site ficaria com duas
// "Shopping China" e o produto anunciado por ela não somaria preço nenhum.
// A comparação tira os hifens dos dois lados; "catalog.newzone.com.py" casa
// com "new-zone" porque cada pedaço do domínio é testado.
let lojaPorDominio = new Map<string, string>();
async function carregarDominiosDeLoja(): Promise<void> {
  const rows = await pool.query("SELECT slug, name FROM store");
  lojaPorDominio = new Map(
    rows.map((r: { slug: string; name: string }) => [r.slug.replace(/-/g, ""), r.name]),
  );
}
function nomeDeLojaPeloDominio(dominio: string): string | null {
  for (const pedaco of dominio.split(".")) {
    if (pedaco.length < 4 || pedaco === "catalog" || pedaco === "loja") continue;
    const achou = lojaPorDominio.get(pedaco);
    if (achou) return achou;
  }
  return null;
}

const storeCache = new Map<string, { id: number; daApi: boolean }>();
async function ensureStore(
  nomeOuDominio: string,
  logo: string | null,
  phone: string | null,
  mapsQuery: string,
): Promise<{ id: number; daApi: boolean }> {
  // Se veio um domínio no lugar do nome, troca pela loja que já existe.
  // Só quando não casa é que vira loja nova, com o domínio como nome.
  let name = nomeOuDominio;
  if (/\.[a-z]{2,}(\.[a-z]{2})?$/i.test(name)) {
    name = nomeDeLojaPeloDominio(name) ?? name;
  }
  const slug = slugify(name);
  if (storeCache.has(slug)) return storeCache.get(slug)!;
  const existing = await pool.query("SELECT id, logo_url, phone FROM store WHERE slug = ? LIMIT 1", [slug]);
  let id: number;
  if (existing.length) {
    id = Number(existing[0].id);
    if ((!existing[0].logo_url && logo) || (!existing[0].phone && phone)) {
      await pool.query("UPDATE store SET logo_url = COALESCE(logo_url, ?), phone = COALESCE(phone, ?) WHERE id = ?", [logo, phone, id]);
    }
  } else {
    const res = await pool.query(
      "INSERT INTO store (slug, name, status, source, is_lead, logo_url, phone, maps_query) VALUES (?, ?, 'active', 'scraped', 1, ?, ?, ?)",
      [slug, name, logo, phone, mapsQuery],
    );
    id = Number(res.insertId);
  }
  const dados = { id, daApi: lojasDaApi.has(id) };
  storeCache.set(slug, dados);
  return dados;
}

// ---------------------------------------------------------------------------
// Lista de espera de preço.
//
// "Sem preço" deixou de ser sentença definitiva. A fonte às vezes mostra a
// caixa de preço vazia — o mesmo produto tinha US$ 67,00 de manhã e nada à
// tarde —, provavelmente enquanto a loja atualiza a lista. Se o coletor
// passasse justo nesse minuto, o produto ficava fora do catálogo até alguém
// reclamar. Agora ele fica em observação por alguns dias e basta ter preço uma
// única vez nesse período para entrar.
// ---------------------------------------------------------------------------
const ESPERA_DIAS = Number(process.env.CRAWL_ESPERA_DIAS ?? 3);
// Teto por volta para a reconferência não competir com a coleta normal.
const ESPERA_POR_VOLTA = Number(process.env.CRAWL_ESPERA_LOTE ?? 400);

async function anotarSemPreco(path: string, origem: string): Promise<void> {
  const ext = path.match(/_(\d+)\/$/)?.[1];
  if (!ext) return;
  await pool.query(
    `INSERT INTO price_watchlist (path, external_id, origem) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE last_try_at = NOW(), tries = tries + 1`,
    [path, `cp-${ext}`, origem],
  );
}

async function saiuDaEspera(path: string): Promise<void> {
  await pool.query("DELETE FROM price_watchlist WHERE path = ?", [path]);
}

// Reconfere quem está em observação. Roda ao fim de cada volta (~4h), então
// dá umas 18 chances ao longo de 3 dias.
async function reverPendentes(): Promise<number> {
  const linhas = await pool.query(
    `SELECT path FROM price_watchlist
      WHERE first_seen_at > NOW() - INTERVAL ? DAY
      ORDER BY last_try_at LIMIT ?`,
    [ESPERA_DIAS, ESPERA_POR_VOLTA],
  );
  // Quem passou do prazo sai: se em 3 dias nunca teve preço, não é oscilação,
  // é produto que a loja parou de vender.
  await pool.query("DELETE FROM price_watchlist WHERE first_seen_at <= NOW() - INTERVAL ? DAY", [ESPERA_DIAS]);
  if (!linhas.length) return 0;

  console.log(`\n=== Lista de espera: reconferindo ${linhas.length} produto(s) sem preço ===`);
  let achados = 0;
  for (const r of linhas) {
    if (stopRequested) break;
    try {
      const n = await ingestProduct(getPage, r.path, "");
      if (n) {
        achados++;
        await markCrawled(`cp-${r.path.match(/_(\d+)\/$/)![1]}`);
        console.log(`  ✓ apareceu preço: ${r.path}`);
      }
      if (browser) await recycleIfNeeded();
    } catch {
      /* tenta de novo na próxima volta */
    }
    await ctlBeat(`lista de espera · ${achados} recuperados`);
    await sleep(DELAY);
  }
  console.log(`=== Lista de espera: ${achados} produto(s) ganharam preço ===\n`);
  return achados;
}

// ---------------------------------------------------------------------------
// Fila dos produtos que exigem navegador (ver migration 027).
//
// O anúncio de loja única precisa do Chromium para o preço aparecer (~2s),
// contra 0,25s da leitura direta. Misturar os dois na mesma fila fazia um
// lento segurar os rápidos que vinham atrás: a volta pulou de 2,3h para 5,9h.
// Aqui a volta normal só ANOTA e segue; o processamento fica para o fim.
// ---------------------------------------------------------------------------
// Quantos produtos de navegador processar ao fim de cada volta.
// A ~2s cada, 1.000 dão uns 33 min de Chromium por volta de 2,3h — cabe sem
// atrapalhar a coleta normal. Com ~96 mil na fila, dá umas 3 semanas.
// Subir isto acelera, mas cobra em carga da máquina: medir antes.
const FILA_LENTA_POR_VOLTA = Number(process.env.CRAWL_FILA_LENTA ?? 1000);

/** Este produto exige navegador?
 *
 * NENHUM, desde 01/08/2026. O anúncio de loja única parecia exigir, porque o
 * preço da caixa do topo é escrito por JavaScript — mas o MESMO preço está no
 * HTML cru, escondido no formulário de "informar preço incorreto". Com isso a
 * leitura direta (0,25s) dá conta de tudo, sem abrir Chromium, e a fila
 * separada virou só a garantia para o que já estava nela.
 *
 * Mantido como função para não espalhar a decisão pelo código: se um dia
 * aparecer um tipo de página que realmente precise, é aqui que se marca. */
const exigeNavegador = (_path: string) => false;

async function enfileirarLento(path: string): Promise<void> {
  const id = path.match(/_(\d+)\/$/)?.[1];
  if (!id) return;
  await pool.query(
    `INSERT INTO render_queue (path, external_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE path = path`,
    [path, `cp-${id}`],
  );
}

async function processarFilaLenta(): Promise<number> {
  const linhas = await pool.query(
    "SELECT path, external_id FROM render_queue ORDER BY last_try_at IS NOT NULL, last_try_at, added_at LIMIT ?",
    [FILA_LENTA_POR_VOLTA],
  );
  if (!linhas.length) return 0;
  console.log(`\n=== Fila lenta: ${linhas.length} produto(s) que precisam de navegador ===`);
  let colhidos = 0;
  for (const r of linhas) {
    if (stopRequested) break;
    await pool.query("UPDATE render_queue SET last_try_at = NOW(), tries = tries + 1 WHERE path = ?", [r.path]);
    try {
      const n = await ingestProduct(getPage, r.path, "");
      if (n) {
        colhidos++;
        await markCrawled(r.external_id);
        // Deu certo: sai da fila. Se não deu, fica para a próxima volta —
        // esse tipo de anúncio passa temporadas sem preço.
        await pool.query("DELETE FROM render_queue WHERE path = ?", [r.path]);
      }
      if (browser) await recycleIfNeeded();
    } catch (e) {
      console.log(`  (erro em ${r.path}: ${(e as Error).message})`);
    }
    await ctlBeat(`fila lenta · ${colhidos}/${linhas.length}`);
    await sleep(DELAY);
  }
  // Desiste de quem já teve muitas chances e nunca rendeu.
  await pool.query("DELETE FROM render_queue WHERE tries >= 20");
  console.log(`=== Fila lenta: ${colhidos} colhido(s) ===\n`);
  return colhidos;
}

async function crawledRecently(ext: string): Promise<boolean> {
  const rows = await pool.query(
    "SELECT 1 FROM scrape_log WHERE external_id = ? AND last_crawled_at > (NOW() - INTERVAL ? HOUR) LIMIT 1",
    [ext, RECRAWL_HOURS],
  );
  return rows.length > 0;
}
async function markCrawled(ext: string): Promise<void> {
  await pool.query("INSERT INTO scrape_log (external_id) VALUES (?) ON DUPLICATE KEY UPDATE last_crawled_at = NOW()", [ext]);
}

// Contadores só para o log: quantas vezes o caminho rápido bastou.
let usouRapido = 0;
let usouNavegador = 0;
let ultimoPlacar = 0;

async function ingestProduct(page: () => Promise<Page>, path: string, ourCategory: string): Promise<number> {
  // Tenta primeiro sem navegador (~0,25s). Só abre o Chromium se falhar.
  let data = await extractProductFast(BASE + path);
  if (data) {
    usouRapido++;
  } else {
    usouNavegador++;
    data = await extractProduct(await page(), BASE + path);
  }
  const name = cleanName(data.name || path);
  if (!name) return 0;
  // Página legível mas sem preço: pode ser a fonte atualizando. Fica em
  // observação em vez de ser descartada (ver anotarSemPreco).
  if (!data.offers.length) {
    await anotarSemPreco(path, origemAtual);
    return 0;
  }

  // Filtra as ofertas DESTE produto (título parecido com o nome do produto).
  const ptoks = tokens(name);
  let kept = data.offers.filter((o) => o.title && overlap(ptoks, tokens(o.title)) >= 0.55);
  if (!kept.length) kept = data.offers;

  // Menor preço por loja — guardando também os dados daquela oferta
  // específica (título, código, foto e link da variação anunciada).
  const byStore = new Map<
    string,
    { price: number; phone: string | null; title: string | null; code: string | null; image: string | null; url: string | null }
  >();
  for (const o of kept) {
    const price = parsePrice(o.price);
    if (!price) continue;
    const cur = byStore.get(o.store);
    if (!cur || price < cur.price) {
      byStore.set(o.store, {
        price,
        phone: o.phone,
        title: o.title,
        code: o.code,
        image: o.image,
        url: o.url,
      });
    }
  }
  // Clientes que enviam a própria lista (self_managed): o scraper os ignora.
  for (const s of [...byStore.keys()]) if (selfManagedSlugs.has(slugify(s))) byStore.delete(s);
  if (!byStore.size) {
    await anotarSemPreco(path, origemAtual);
    return 0;
  }
  // Deu certo: se estava em observação, sai da lista.
  await saiuDaEspera(path);
  const minPrice = Math.min(...[...byStore.values()].map((v) => v.price));

  const slug = slugify(name);
  // A categoria sai do nome do produto ("Robô de Limpeza Xiaomi…" → robo-de-limpeza);
  // se o nome não revelar, fica a categoria da página em que ele foi encontrado.
  const catSlug = categoryFromProductSlug(slug, categorySlugs) ?? ourCategory;
  const catId = categoryIdBySlug.get(catSlug) ?? (await getCategoryId(ourCategory));
  // A marca também sai do nome ("Celular Xiaomi Redmi…" → Xiaomi).
  const marca = brandFromName(name, catSlug, brandIndex);
  const pres = await pool.query(
    `INSERT INTO product (slug, canonical_name, category_id, source_category, brand, min_price_usd, ext_store_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), canonical_name = VALUES(canonical_name),
       category_id = VALUES(category_id), source_category = VALUES(source_category),
       brand = COALESCE(VALUES(brand), product.brand),
       min_price_usd = VALUES(min_price_usd), ext_store_count = VALUES(ext_store_count)`,
    [slug, name, catId, catSlug, marca, minPrice, byStore.size],
  );
  const productId = Number(pres.insertId);

  if (data.specs.length) {
    await pool.query("UPDATE product SET specs = ? WHERE id = ?", [JSON.stringify(data.specs), productId]);
  }

  if (data.image) {
    const cur = await pool.query("SELECT primary_image_url FROM product WHERE id = ?", [productId]);
    if (!cur[0]?.primary_image_url) {
      const stored = await ingestImageFromUrl(data.image);
      if (stored) await pool.query("UPDATE product SET primary_image_url = ? WHERE id = ?", [stored, productId]);
    }
  }

  const vres = await pool.query(
    "INSERT INTO product_variant (product_id, signature, title) VALUES (?, '', NULL) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)",
    [productId],
  );
  const variantId = Number(vres.insertId);
  const idM = path.match(/_(\d+)\/$/);
  const ext = idM ? `cp-${idM[1]}` : path;

  for (const [storeName, info] of byStore) {
    const { id: storeId, daApi } = await ensureStore(storeName, data.logos[storeName] ?? null, info.phone, `${storeName}, Paraguay`);
    // Loja da plataforma: o preço dela vem da API, não daqui.
    //
    // Só o preço é preservado — a oferta raspada continua no ar até o primeiro
    // envio da loja chegar. Se o coletor apagasse, a loja sumiria do site entre
    // assinar o plano e mandar o primeiro arquivo.
    if (daApi) {
      await pool.query(
        "UPDATE offer o JOIN product_variant v ON v.id = o.variant_id SET o.last_seen_at = NOW() WHERE v.id = ? AND o.store_id = ?",
        [variantId, storeId],
      );
      await pool.query("INSERT IGNORE INTO product_store (product_id, store_id) VALUES (?, ?)", [productId, storeId]);
      continue;
    }
    await pool.query(
      `INSERT INTO offer (variant_id, store_id, price, currency, price_usd, in_stock, source,
                          external_id, title, code, image_url, url, last_seen_at)
       VALUES (?, ?, ?, 'USD', ?, 1, 'scraped', ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE price = VALUES(price), price_usd = VALUES(price_usd),
         title = COALESCE(VALUES(title), offer.title), code = COALESCE(VALUES(code), offer.code),
         image_url = COALESCE(VALUES(image_url), offer.image_url), url = COALESCE(VALUES(url), offer.url),
         last_seen_at = NOW()`,
      [variantId, storeId, info.price, info.price, ext, info.title, info.code, info.image, info.url],
    );
    await pool.query("INSERT IGNORE INTO product_store (product_id, store_id) VALUES (?, ?)", [productId, storeId]);
  }
  return byStore.size;
}

async function refreshCatalog(): Promise<void> {
  const prov = getEmbeddingProvider();
  const missing = await pool.query(
    "SELECT p.id, p.brand, p.canonical_name FROM product p LEFT JOIN product_embedding e ON e.product_id = p.id WHERE e.product_id IS NULL LIMIT 20000",
  );
  for (const r of missing) {
    const [vec] = await prov.embed([`${r.brand ?? ""} ${r.canonical_name}`.trim()]);
    await pool.query(
      "INSERT INTO product_embedding (product_id, embedding, model) VALUES (?, VEC_FromText(?), ?) ON DUPLICATE KEY UPDATE embedding = VALUES(embedding)",
      [r.id, JSON.stringify(vec), prov.name],
    );
  }
  // A categoria vem do nome do produto (ver taxonomy.ts) e já é gravada na
  // ingestão. Aqui só cobrimos quem por algum motivo ficou sem categoria.
  const semCategoria = await pool.query("SELECT id, slug FROM product WHERE category_id IS NULL LIMIT 5000");
  for (const p of semCategoria) {
    const catSlug = categoryFromProductSlug(p.slug, categorySlugs);
    if (catSlug) await ensureCategory(p.id, catSlug);
  }
  const n = await syncProducts();
  console.log(`  ↻ catálogo atualizado (${missing.length} embeddings · ${n} indexados)`);
}

// Varredura pelo MAPA DO SITE da fonte — a rede de segurança.
//
// Por que existe: percorrer categoria por categoria sempre deixa alguém de
// fora. Em 01/08/2026 comparei o mapa do site (21.696 produtos) com tudo o que
// o coletor já tinha visitado (21.583) e sobravam **282 produtos que nunca
// haviam sido tocados** — 173 deles perfumes, todos à venda de verdade, com 8
// a 12 lojas cada. Eles simplesmente não apareciam nas páginas de categoria.
//
// O mapa do site é a lista que a própria fonte publica para buscadores: é a
// verdade sobre o que existe lá. Rodando isto ao fim de cada volta, nenhum
// produto consegue mais ficar escondido, seja qual for o motivo.
//
// Custa ~176 requisições (1 minuto) por volta de 4 horas.
const SITEMAP = `${BASE}/sitemap.xml`;

async function listarSitemaps(): Promise<string[]> {
  const xml = await fetchText(SITEMAP);
  if (!xml) return [];
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

// Abaixo disto o mapa está claramente quebrado (em 01/08/2026 tinha 21.696).
// Sem esta guarda, uma mudança de formato na fonte deixaria a rede de segurança
// desligada em silêncio — e ninguém ficaria sabendo até alguém reclamar.
const MINIMO_ESPERADO = 15000;

async function gravarCobertura(
  status: string,
  detail: string,
  n?: { fonte: number; vistos: number; faltando: number },
): Promise<void> {
  await pool.query(
    `UPDATE catalog_coverage
        SET checked_at = NOW(), status = ?, detail = ?,
            source_total = ?, seen_total = ?, missing_total = ?
      WHERE id = 1`,
    [status, detail.slice(0, 500), n?.fonte ?? 0, n?.vistos ?? 0, n?.faltando ?? 0],
  );
}

async function varrerSitemap(): Promise<number> {
  origemAtual = "mapa";
  const mapas = await listarSitemaps();
  if (!mapas.length) {
    console.log("  ⚠ não consegui ler o mapa do site — rede de segurança FORA DO AR nesta volta");
    await gravarCobertura("mapa-inacessivel", `não consegui abrir ${SITEMAP}`);
    return 0;
  }
  const caminhos = new Set<string>();
  for (const m of mapas) {
    const xml = await fetchText(m);
    if (xml) {
      for (const mm of xml.matchAll(/<loc>https?:\/\/[^/]+(\/[a-z0-9-]+_\d+\/)<\/loc>/gi)) {
        caminhos.add(mm[1]);
      }
    }
    await sleep(250);
    if (stopRequested) return 0;
  }

  if (caminhos.size < MINIMO_ESPERADO) {
    console.log(`  ⚠ mapa do site veio com só ${caminhos.size} produtos (esperado 15 mil+) — não confio, varredura cancelada`);
    await gravarCobertura(
      "mapa-suspeito",
      `o mapa do site devolveu ${caminhos.size} produtos, muito abaixo do normal — a fonte pode ter mudado o formato`,
    );
    return 0;
  }

  // Fica só com o que o coletor nunca viu. Produto já conhecido é assunto da
  // volta normal, que o revisita a cada RECRAWL_HOURS.
  const inéditos: string[] = [];
  for (const path of caminhos) {
    const idM = path.match(/_(\d+)\/$/);
    if (!idM) continue;
    const [r] = await pool.query("SELECT COUNT(*) n FROM scrape_log WHERE external_id = ?", [`cp-${idM[1]}`]);
    if (Number(r.n) === 0) inéditos.push(path);
  }
  console.log(`\n=== Mapa do site: ${caminhos.size} produtos na fonte · ${inéditos.length} nunca visitados ===`);
  await gravarCobertura(
    inéditos.length ? "faltando" : "ok",
    inéditos.length
      ? `${inéditos.length} produto(s) da fonte ainda não visitados — recuperando agora`
      : `tudo o que existe na fonte já está aqui`,
    { fonte: caminhos.size, vistos: caminhos.size - inéditos.length, faltando: inéditos.length },
  );
  if (!inéditos.length) return 0;

  let colhidos = 0;
  for (const path of inéditos) {
    if (stopRequested) break;
    const ext = `cp-${path.match(/_(\d+)\/$/)![1]}`;
    try {
      // Sem categoria de origem: ela sai do NOME do produto, como sempre.
      const n = await ingestProduct(getPage, path, "");
      if (n) colhidos++;
      // Anota a visita MESMO quando não rendeu nada.
      //
      // Dos 282 que apareceram na primeira varredura, conferi 20 e os 20
      // estavam SEM NENHUMA LOJA vendendo: são páginas que a fonte mantém no
      // ar só pelo histórico de preço. Sem esta marca o coletor voltaria a
      // baixar as mesmas 282 páginas a cada volta, para sempre, sem ganhar
      // nada. Se algum dia uma delas voltar a ser vendida, ela reaparece nas
      // páginas de categoria e a volta normal a pega.
      await markCrawled(ext);
      if (browser) await recycleIfNeeded();
    } catch (e) {
      console.log(`  (erro em ${path}: ${(e as Error).message})`);
    }
    await ctlBeat(`mapa do site · ${colhidos}/${inéditos.length} recuperados`);
    await sleep(DELAY);
  }
  console.log(`=== Mapa do site: ${colhidos} produto(s) recuperados ===\n`);
  // Depois de recuperar, o que sobrou são páginas sem loja vendendo.
  await gravarCobertura(
    "ok",
    colhidos
      ? `${colhidos} produto(s) recuperados pelo mapa do site; o resto são páginas sem loja vendendo`
      : `os ${inéditos.length} que faltavam não têm loja vendendo — nada a recuperar`,
    { fonte: caminhos.size, vistos: caminhos.size, faltando: 0 },
  );
  return colhidos;
}

// Varredura pelas PÁGINAS DE MARCA — o caminho que o dono do site percorre
// na mão quando desconfia que falta produto.
//
// Por que é diferente de tudo que veio antes: as categorias e o mapa do site
// só mostram o catálogo "principal". Os anúncios de loja única (endereço com
// "__") NÃO aparecem em nenhum dos dois — só na busca e nas páginas de marca.
// Foi assim que faltaram 10 Kerastase Elixir sem que nenhuma das minhas
// conferências percebesse: todas perguntavam "coletei tudo que eu conheço?",
// e a resposta era sim. A pergunta certa é "a fonte me mostra algo que eu não
// tenho?" — e a página de marca responde isso.
//
// São ~1.900 marcas. A ~1,2s cada dá uns 38 minutos, então NÃO roda a cada
// volta: é a auditoria de domingo que chama (`--marcas`).
async function varrerMarcas(): Promise<number> {
  origemAtual = "marcas";
  const html = await fetchText(`${BASE}/marcas/`);
  if (!html) {
    console.log("  não consegui abrir a lista de marcas");
    return 0;
  }
  const marcas = [...new Set([...html.matchAll(/href="\/marcas\/([a-z0-9-]+)\/"/gi)].map((m) => m[1]))];
  console.log(`\n=== Marcas: ${marcas.length} páginas a percorrer ===`);

  let colhidos = 0;
  let vistos = 0;
  for (const marca of marcas) {
    if (stopRequested) break;
    const pag = await fetchText(`${BASE}/marcas/${marca}/`);
    await sleep(DELAY);
    if (!pag) continue;
    for (const path of extractProductPaths(pag)) {
      if (stopRequested) break;
      const idM = path.match(/_(\d+)\/$/);
      if (!idM) continue;
      const ext = `cp-${idM[1]}`;
      if (await crawledRecently(ext)) continue;
      const [r] = await pool.query("SELECT COUNT(*) n FROM scrape_log WHERE external_id = ?", [ext]);
      if (Number(r.n) > 0) continue; // já conhecido, a volta normal cuida
      vistos++;
      // Aqui também: o lento vai para a fila em vez de segurar a varredura.
      if (exigeNavegador(path)) {
        await enfileirarLento(path);
        continue;
      }
      try {
        const n = await ingestProduct(getPage, path, "");
        // Só marca como visto quando RENDEU.
        //
        // Ao contrário das páginas mortas do mapa do site, o anúncio de loja
        // única costuma ficar sem preço por um tempo e voltar a ter. Marcar um
        // sem preço o excluiria desta varredura para sempre — e ele não
        // aparece em categoria nenhuma, então ninguém mais o pegaria.
        // Custa refazer alguns por semana; barato perto de perder produto.
        if (n) {
          colhidos++;
          await markCrawled(ext);
        }
        if (browser) await recycleIfNeeded();
      } catch (e) {
        console.log(`  (erro em ${path}: ${(e as Error).message})`);
      }
      await sleep(DELAY);
    }
    await ctlBeat(`marcas · ${marca} · ${colhidos} novos`);
  }
  console.log(`=== Marcas: ${vistos} produtos inéditos encontrados, ${colhidos} colhidos ===\n`);
  return colhidos;
}

async function crawlCategory(cat: Cat): Promise<number> {
  origemAtual = "categoria";
  console.log(`\n=== Categoria: ${cat.path} -> ${cat.our} ===`);
  let processed = 0;
  const seenPaths = new Set<string>();
  let paginaAnterior = new Set<string>();
  for (let pageN = 1; !MAX_PAGES || pageN <= MAX_PAGES; pageN++) {
    const html = await fetchText(`${BASE}/${cat.path}/?page=${pageN}`);
    await sleep(DELAY);
    if (!html) break;
    const paths = extractProductPaths(html);
    if (!paths.length) {
      console.log(`  fim da paginação (página ${pageN}).`);
      break;
    }
    // Fim REAL da paginação: passado o último número de página, o site repete
    // a última. Comparamos com a página anterior em vez de "não veio nada
    // novo", porque os carrosséis do topo mudam de item a cada requisição e
    // sempre trariam algum link inédito, o que faria a paginação nunca parar.
    const iguais = paths.filter((p) => paginaAnterior.has(p)).length;
    if (pageN > 1 && iguais >= paths.length * 0.9) {
      console.log(`  paginação repetiu (página ${pageN}) — fim da categoria "${cat.path}".`);
      break;
    }
    paginaAnterior = new Set(paths);

    const newPaths = paths.filter((p) => !seenPaths.has(p));
    if (!newPaths.length) {
      console.log(`  nada novo na página ${pageN} — fim da categoria "${cat.path}".`);
      break;
    }
    newPaths.forEach((p) => seenPaths.add(p));
    console.log(`  página ${pageN}: ${paths.length} produto(s) (${newPaths.length} novos)`);

    let ingestedThisPage = 0;
    for (const path of newPaths) {
      const idM = path.match(/_(\d+)\/$/);
      const ext = idM ? `cp-${idM[1]}` : path;
      if (!DRY && (await crawledRecently(ext))) continue;
      // Produto que exige navegador NÃO para a fila: anota e segue.
      // Era isto que fazia um lento (2s) segurar os 30 rápidos (0,25s) que
      // vinham atrás e inflava a volta de 2,3h para 5,9h.
      if (!DRY && exigeNavegador(path)) {
        await enfileirarLento(path);
        continue;
      }

      try {
        if (DRY) {
          const d = await extractProduct(await getPage(), BASE + path);
          const nm = cleanName(d.name || path);
          const pt = tokens(nm);
          const kept = d.offers.filter((o) => o.title && overlap(pt, tokens(o.title)) >= 0.55);
          const stores = new Set(kept.map((o) => o.store));
          console.log(`  [DRY] ${nm} — ${stores.size} lojas c/ preço (${[...stores].slice(0, 4).join(", ")})`);
        } else {
          // getPage é passado como função: assim o navegador só é aberto se
          // a leitura rápida falhar.
          const n = await ingestProduct(getPage, path, cat.our);
          if (n) {
            await markCrawled(ext);
            ingestedThisPage++;
          }
          if (browser) await recycleIfNeeded();
        }
      } catch (e) {
        const msg = (e as Error).message;
        console.log(`  (erro no produto ${path}: ${msg})`);
        // Navegador caiu: derruba o que sobrou para que o próximo produto
        // suba um navegador novo, em vez de repetir o erro até o fim.
        if (/closed|crash|disconnect|Target page/i.test(msg)) {
          console.log("  ⚠ navegador caiu — subindo outro.");
          await closeBrowser();
        }
      }
      await sleep(DELAY);
      processed++;
      await ctlBeat(`${cat.path} · página ${pageN} · ${processed} coletados`);
      if (!DRY && (await ctlShouldStop())) {
        stopRequested = true;
        return processed;
      }
      if (MAX_PRODUCTS && processed >= MAX_PRODUCTS) return processed;
    }
    if (DRY) break;
    // Publica no site só quando algo novo entrou (evita re-indexar à toa).
    if (ingestedThisPage > 0) {
      await refreshCatalog();
      await ctlBeat(`${cat.path} · página ${pageN} publicada · ${processed} coletados`);
    } else {
      await ctlBeat(`${cat.path} · varrendo página ${pageN} (nada novo)`);
    }
    // Placar a cada 100 produtos: mostra se o caminho rápido está bastando.
    const lidos = usouRapido + usouNavegador;
    if (lidos > 0 && lidos - ultimoPlacar >= 100) {
      ultimoPlacar = lidos;
      console.log(`  ⚡ ${usouRapido} sem navegador · ${usouNavegador} com navegador`);
    }
  }
  console.log(`  categoria "${cat.path}": ${processed} produto(s).`);
  return processed;
}

async function main(): Promise<void> {
  const argCats = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  let categories: Array<{ path: string; our: string }>;
  if (argCats.length) {
    categories = argCats.map((s) => ({ path: s, our: s }));
  } else {
    categories = await discoverCategories();
    if (categories.length < 5) categories = ALL_CATEGORIES; // fallback se a descoberta falhar
  }

  console.log(
    `Coletor iCompras — robô ${WORKER_ID + 1} de ${WORKERS}${CHEFE ? " (chefe)" : ""} · ` +
      `${DRY ? "DRY" : MONITOR ? "MONITOR" : "passe único"} · pausa ${DELAY}ms ` +
      `(teto de ${RPS} pedidos/s somando todos) · ${categories.length} categorias`,
  );

  // O navegador NÃO é aberto de saída: a leitura rápida (sem Chromium) dá
  // conta da quase totalidade dos produtos. Ele sobe sozinho, via getPage(),
  // apenas quando alguma página não puder ser lida do jeito rápido.

  if (!DRY) await ctlStart();

  // Modos de varredura avulsa: recuperam na hora e saem.
  if (SO_MAPA || SO_MARCAS || SO_FILA) {
    await loadSelfManaged();
    await loadCategories();
    await loadBrandIndex();
    await carregarLojasDaApi();
    await carregarDominiosDeLoja();
    const n = SO_FILA ? await processarFilaLenta() : SO_MARCAS ? await varrerMarcas() : await varrerSitemap();
    if (n > 0) await refreshCatalog();
    await atualizarResumoDiario();
    await closeBrowser();
    await ctlFinish(`varredura (${SO_FILA ? "fila lenta" : SO_MARCAS ? "marcas" : "mapa do site"}): ${n} produto(s) recuperados`);
    await pool.end();
    return;
  }

  try {
    do {
      if (!DRY) {
        await loadSelfManaged();
        await loadCategories();
        await loadBrandIndex();
        await carregarLojasDaApi();
        await carregarDominiosDeLoja();
        storeCache.clear(); // a marca "é da API" fica no cache; recarrega junto
        if (CHEFE) await atualizarResumoDiario();
      }
      if (!DRY && CHEFE) {
        await cycleStart(categories.length);
        await semearCategorias(categories);
      }

      // MODO DE VÁRIOS ROBÔS: em vez de percorrer a lista inteira, cada robô
      // pede uma categoria de cada vez e trabalha nela. Quem terminar primeiro
      // pega a próxima — assim ninguém fica parado esperando o outro, e
      // categoria gorda (16 páginas) não segura a fila.
      //
      // Com um robô só, o comportamento é o mesmo de antes.
      const fila = DRY ? categories : [];
      let inicioDaVolta = "1970-01-01";
      if (!DRY) {
        const [ctl] = await pool.query("SELECT cycle_started_at FROM scrape_control WHERE id = 1");
        inicioDaVolta = ctl?.cycle_started_at
          ? new Date(ctl.cycle_started_at).toISOString().slice(0, 19).replace("T", " ")
          : "1970-01-01";
      }

      for (;;) {
        let cat: Cat | null = null;
        if (DRY) {
          cat = fila.shift() ?? null;
        } else {
          cat = await reivindicarCategoria(inicioDaVolta);
          if (!cat) break; // acabou o serviço desta volta
        }
        if (!cat) break;

        const n = await crawlCategory(cat);
        if (stopRequested) break;
        if (!DRY) {
          await catDone(cat, n);
          // As varreduras de fim de volta são do CHEFE.
          //
          // Rodar em quatro seria quatro vezes o mesmo trabalho — e quatro
          // varreduras do mapa do site ao mesmo tempo é justamente o tipo de
          // rajada que a divisão do teto existe para evitar.
          if (CHEFE && (await cycleMaybeClose(categories.length))) {
            await processarFilaLenta();
            await reverPendentes();
            // Varredura pelas marcas: é o ÚNICO caminho para os produtos que
            // não aparecem em categoria nenhuma.
            //
            // Descoberto em 02/08/2026: os Kerastase Elixir que o dono do site
            // reclamou seguiam sem entrar mesmo depois de tudo. Motivo: eu
            // tinha escrito a varrerMarcas() mas só a chamava com a opção
            // --marcas, na mão. Enquanto isso 14.742 produtos do catálogo novo
            // entraram pelas categorias — o que escondeu o buraco, porque
            // parecia que estava tudo funcionando.
            await varrerMarcas();
            await varrerSitemap();
          }
          if (n > 0 && CHEFE) await refreshCatalog();
        }
      }
      if (stopRequested) break;
      if (MONITOR && !DRY) {
        console.log(`\nCiclo completo. Aguardando ${CYCLE_MIN} min...`);
        const totalMs = CYCLE_MIN * 60 * 1000;
        for (let waited = 0; waited < totalMs; waited += 5000) {
          await ctlBeat(`aguardando próximo ciclo (${Math.round((totalMs - waited) / 60000)} min)`);
          if (await ctlShouldStop()) {
            stopRequested = true;
            break;
          }
          await sleep(5000);
        }
        if (stopRequested) break;
      }
    } while (MONITOR && !DRY);
  } finally {
    await closeBrowser();
  }

  if (!DRY) await ctlFinish(stopRequested ? "parado pelo painel" : "ciclo concluído");
  console.log(stopRequested ? "\nParado pelo painel." : "\nConcluído.");
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await ctlFinish(`erro: ${(err as Error).message}`.slice(0, 250));
  } catch {
    /* ignore */
  }
  process.exit(1);
});
