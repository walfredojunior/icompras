// Auditoria de cobertura do catálogo — responde "está faltando produto?".
//
// COMO ERA (31/07): percorria as ~315 categorias vazias e conferia se a fonte
// tinha produto nelas. Respondia a pergunta errada ("alguma categoria está
// vazia?") e gastava 315 requisições para isso.
//
// COMO É (01/08): usa o MAPA DO SITE da fonte — `sitemap.xml`, um índice com
// 176 sub-mapas listando os ~21.700 produtos dela. É a lista que a própria
// fonte publica para os buscadores, ou seja, a verdade sobre o que existe lá.
// Custa 176 requisições e responde a pergunta certa, produto por produto.
//
//   npm run auditoria -w @icompras/worker
//   npm run auditoria -w @icompras/worker -- --rapida   (confere só 30 dos que faltam)
//
// O guardião dispara isto sozinho aos domingos de madrugada (ver guardiao.ts).
import "../env.js";
import { pool } from "@icompras/db";
import { parse as parseHtml } from "node-html-parser";

const BASE = "https://www.comprasparaguai.com.br";
const SITEMAP = `${BASE}/sitemap.xml`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const DELAY = Number(process.env.AUDIT_DELAY_MS ?? 900);
// Abaixo disto o mapa está quebrado.
//
// ⚠ ERA 15.000, de quando a auditoria só enxergava os modelos (21.696 em
// 01/08/2026). Depois de passar a ler também os anúncios, o mapa devolve
// ~336 mil páginas — e um piso de 15 mil deixaria de proteger: os 314 mil
// anúncios poderiam sumir inteiros que a trava continuaria satisfeita com os
// 22 mil modelos restantes. Piso desatualizado não avisa, só tranquiliza.
const MINIMO_ESPERADO = num(process.env.AUDIT_MIN_PAGINAS, 200_000);
// Quantos dos que faltam abrir de verdade para ver se têm loja vendendo. Cada
// um custa ~1s (DELAY), então sem teto uma auditoria com 40 mil faltantes
// rodaria por 11 horas. O que passar do teto é CONTADO e dito em voz alta —
// truncar calado faria a auditoria parecer completa quando não é.
const TETO_CONFERENCIA = num(process.env.AUDIT_MAX_CONFERIR, 300);

function num(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}
const RAPIDA = process.argv.includes("--rapida");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function baixar(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,es;q=0.8" },
      signal: AbortSignal.timeout(40000),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

// Quantas LOJAS estão vendendo este produto agora.
//
// Conta só o bloco que tem o botão da loja com o nome do anunciante. Contar
// `.promocao-item` ou `promocao-item-caracteristicas` engana: essas marcações
// aparecem também nos cards de "produtos relacionados" no rodapé da página —
// foi o que quase me fez concluir que 282 páginas mortas tinham 8 a 12 lojas.
async function lojasVendendo(caminho: string): Promise<number | null> {
  const html = await baixar(BASE + caminho);
  if (!html) return null;
  const raiz = parseHtml(html);
  let n = 0;
  for (const info of raiz.querySelectorAll(".promocao-item-info")) {
    const oc = info.querySelector(".btn-store-redirect")?.getAttribute("onclick") ?? "";
    if (/advertiser/.test(oc)) n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// O CONTADOR CEGO.
//
// Toda conferência que eu tinha feito antes perguntava "coletei tudo o que eu
// conheço?" — usando as MESMAS regras do coletor. Quando a regra está errada,
// a conferência herda a cegueira e responde "100%" com toda a confiança. Foi
// assim três vezes: o denylist do `games`, as 377 categorias de nome composto,
// e o formato de endereço com "__". Nas três, quem achou foi o dono do site.
//
// Este contador não sabe nada. Ele abre uma página da fonte, conta o que está
// escrito ali e compara com o que temos. Não usa o `extractProductPaths` do
// coletor de propósito — se usasse, herdaria o mesmo defeito.
//
// Duas medidas INDEPENDENTES por página:
//   1. links que terminam em _NÚMERO/  (padrão bem mais largo que o do coletor)
//   2. quantidade de cartões de produto desenhados na página
// Se (2) for bem maior que (1), o formato dos endereços mudou e nem este
// contador está enxergando — e ele avisa isso em vez de dizer que está tudo bem.
// ---------------------------------------------------------------------------

// Aceita QUALQUER coisa terminada em _dígitos/ — um traço, dois, acento,
// maiúscula, o que for. É a regra mais larga que ainda significa "produto".
const LINK_LARGO = /href="(\/[^"]*?_+\d+\/)"/gi;

interface Achado {
  pagina: string;
  mostra: number;   // produtos que a página exibe
  temos: number;    // quantos desses já estão no nosso banco
  cartoes: number;  // conferência independente
}

async function contarPagina(caminho: string): Promise<Achado | null> {
  const html = await baixar(BASE + caminho);
  if (!html) return null;

  const codigos = new Set<string>();
  for (const m of html.matchAll(LINK_LARGO)) {
    const c = m[1].match(/_(\d+)\/$/)?.[1];
    if (c) codigos.add(c);
  }
  // Medida independente: cartões de produto desenhados.
  //
  // O `(?![-\w])` é essencial: cada cartão tem TRÊS marcações que começam
  // igual — promocao-produtos-item, -item-box e -item-text. Sem o corte eu
  // contava 3 por cartão e acusava "não entendi os links" em página sadia
  // (aconteceu com /celular/: 72 "cartões" para 24 reais).
  const cartoes = (html.match(/promocao-produtos-item(?![-\w])/g) || []).length;

  let temos = 0;
  const lista = [...codigos];
  for (let i = 0; i < lista.length; i += 100) {
    const lote = lista.slice(i, i + 100);
    const [r] = await pool.query(
      `SELECT COUNT(*) n FROM scrape_log WHERE external_id IN (${lote.map(() => "?").join(",")})`,
      lote.map((c) => `cp-${c}`),
    );
    temos += Number(r.n);
  }
  return { pagina: caminho, mostra: codigos.size, temos, cartoes };
}

// Monta a amostra: categorias nossas + marcas da fonte + lojas.
// Três caminhos diferentes de propósito — o catálogo de loja única, por
// exemplo, só aparece nas páginas de marca.
async function montarAmostra(quantas: number): Promise<string[]> {
  const cats = (
    await pool.query(
      `SELECT c.slug FROM category c
        WHERE EXISTS (SELECT 1 FROM product p WHERE p.category_id = c.id)
        ORDER BY RAND() LIMIT ?`,
      [quantas],
    )
  ).map((r: { slug: string }) => `/${r.slug}/`);

  const marcasHtml = await baixar(`${BASE}/marcas/`);
  const marcas = marcasHtml
    ? [...new Set([...marcasHtml.matchAll(/href="\/marcas\/([a-z0-9-]+)\/"/gi)].map((m) => m[1]))]
        .sort(() => Math.random() - 0.5)
        .slice(0, quantas)
        .map((m) => `/marcas/${m}/`)
    : [];

  const lojasHtml = await baixar(`${BASE}/lojas/`);
  const lojas = lojasHtml
    ? [...new Set([...lojasHtml.matchAll(/href="\/lojas\/([a-z0-9-]+)\/"/gi)].map((m) => `/lojas/${m[1]}/`))]
    : [];

  return [...cats, ...marcas, ...lojas];
}

async function registrar(status: string, detail: string): Promise<void> {
  await pool.query(
    "INSERT INTO watchdog_log (target, status, detail, action) VALUES ('auditoria', ?, ?, 'nenhuma')",
    [status, detail.slice(0, 500)],
  );
  console.log(`\n${status.toUpperCase()}: ${detail}`);
}

async function main(): Promise<void> {
  const inicio = Date.now();
  console.log("Auditoria de cobertura pelo mapa do site");

  const indice = await baixar(SITEMAP);
  if (!indice) {
    await pool.query("UPDATE catalog_coverage SET checked_at = NOW(), status = 'mapa-inacessivel', detail = ? WHERE id = 1", [
      `não consegui abrir ${SITEMAP}`,
    ]);
    await registrar("erro", `não consegui abrir o mapa do site (${SITEMAP}) — a rede de segurança do coletor depende dele`);
    await pool.end();
    return;
  }

  const mapas = [...indice.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log(`  ${mapas.length} sub-mapas`);

  // ⚠⚠ `_+`, COM O MAIS. NÃO TROCAR POR `_`. ⚠⚠
  //
  // A versão anterior exigia UM underline (`[a-z0-9-]+_\d+`) e por isso via
  // só metade da fonte. Ela tem DOIS níveis de endereço:
  //
  //   /roteador-tp-link-tl-wr741nd_565/        1 underline  → MODELO (agregado)
  //   /apple-iphone-17-pro-max-a3257__5015387/ 2 underlines → ANÚNCIO de 1 loja
  //
  // Medido em 12/08/2026: 22.252 modelos e 263.883 anúncios do nosso lado.
  // A auditoria enxergava os 22 mil e era CEGA para os 264 mil — e escrevia
  // "21.700 produtos na fonte" com toda a confiança.
  //
  // 💡 O detalhe que dói: **o formato com `__` já tinha escondido catálogo
  // antes** — está escrito no comentário do "contador cego" logo acima, como
  // uma das três vezes em que o dono achou o que a conferência não achou.
  // Consertaram o coletor e esqueceram a auditoria. O contador cego usa `_+`;
  // esta linha usava `_`. **Quando um formato novo aparecer, procurar TODOS os
  // lugares que casam endereço, não só o que estourou.**
  const caminhos = new Set<string>();
  for (const m of mapas) {
    const xml = await baixar(m);
    if (xml) {
      for (const mm of xml.matchAll(/<loc>https?:\/\/[^/]+(\/[a-z0-9-]+_+\d+\/)<\/loc>/gi)) caminhos.add(mm[1]);
    }
    await sleep(200);
  }
  // Separado porque são coisas diferentes: modelo é a ficha do produto, anúncio
  // é a oferta de uma loja. Cobertura de 90% em modelos e 60% em anúncios é um
  // problema bem diferente do inverso, e a soma esconderia os dois.
  let modelos = 0;
  let anuncios = 0;
  for (const c of caminhos) (/__\d+\/$/.test(c) ? anuncios++ : modelos++);
  console.log(`  ${caminhos.size} páginas no mapa da fonte (${modelos} modelos + ${anuncios} anúncios)`);

  if (caminhos.size < MINIMO_ESPERADO) {
    await pool.query("UPDATE catalog_coverage SET checked_at = NOW(), status = 'mapa-suspeito', detail = ? WHERE id = 1", [
      `o mapa devolveu ${caminhos.size} produtos, muito abaixo do normal`,
    ]);
    await registrar(
      "erro",
      `o mapa do site devolveu só ${caminhos.size} produtos (esperado 15 mil+) — a fonte pode ter mudado o formato, e a rede de segurança do coletor está cega`,
    );
    await pool.end();
    return;
  }

  // Quais o coletor nunca visitou.
  //
  // ⚠ EM LOTES, e isto deixou de ser detalhe. A versão anterior fazia UMA
  // consulta por produto: com 21 mil modelos já era lento, e depois de enxergar
  // os anúncios seriam **314 mil consultas** numa auditoria só — de madrugada,
  // no mesmo banco que atende o site. Em lotes de 500 são ~630 consultas.
  //
  // 💡 Regra: ao ampliar o que um laço percorre, conferir o que ele faz POR
  // volta. Multiplicar o alcance por 15 multiplica o custo por 15, e foi assim
  // que o Meilisearch e os relacionados viraram incidente esta semana.
  const naoVistos: string[] = [];
  const porId = new Map<string, string>();
  for (const caminho of caminhos) {
    const id = caminho.match(/_(\d+)\/$/)?.[1];
    if (id) porId.set(`cp-${id}`, caminho);
  }
  const ids = [...porId.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const lote = ids.slice(i, i + 500);
    const linhas = await pool.query(
      `SELECT external_id FROM scrape_log WHERE external_id IN (${lote.map(() => "?").join(",")})`,
      lote,
    );
    const vistos = new Set(linhas.map((r: { external_id: string }) => r.external_id));
    for (const id of lote) if (!vistos.has(id)) naoVistos.push(porId.get(id)!);
  }
  const faltamModelos = naoVistos.filter((c) => !/__\d+\/$/.test(c)).length;
  console.log(
    `  ${naoVistos.length} nunca visitados` +
      ` (${faltamModelos} modelos de ${modelos}, ${naoVistos.length - faltamModelos} anúncios de ${anuncios})`,
  );
  if (caminhos.size > 0) {
    const pct = Math.round((100 * (caminhos.size - naoVistos.length)) / caminhos.size);
    console.log(`  COBERTURA: ${pct}%`);
  }

  // Dos que faltam, quantos têm loja vendendo? É o número que importa: página
  // sem loja nenhuma é histórico que a fonte mantém no ar, não é catálogo.
  const teto = RAPIDA ? 30 : TETO_CONFERENCIA;
  const conferir = naoVistos.slice(0, teto);
  if (naoVistos.length > conferir.length) {
    console.log(
      `  ⚠ conferindo ${conferir.length} dos ${naoVistos.length} que faltam` +
        ` — os outros ${naoVistos.length - conferir.length} NÃO foram abertos nesta rodada`,
    );
  }
  const comLoja: string[] = [];
  let semResposta = 0;
  for (let i = 0; i < conferir.length; i++) {
    const n = await lojasVendendo(conferir[i]);
    if (n === null) semResposta++;
    else if (n > 0) {
      comLoja.push(conferir[i]);
      console.log(`  FALTA DE VERDADE: ${conferir[i]} (${n} lojas)`);
    }
    if ((i + 1) % 50 === 0) console.log(`  ...${i + 1}/${conferir.length}`);
    await sleep(DELAY);
  }

  const minutos = Math.round((Date.now() - inicio) / 60000);
  const semLoja = conferir.length - comLoja.length - semResposta;

  await pool.query(
    `UPDATE catalog_coverage
        SET checked_at = NOW(), status = ?, detail = ?,
            source_total = ?, seen_total = ?, missing_total = ?, missing_sellable = ?
      WHERE id = 1`,
    [
      comLoja.length ? "faltando" : "ok",
      comLoja.length
        ? `${comLoja.length} produto(s) à venda na fonte e ausentes aqui`
        : `tudo o que está à venda na fonte já está aqui`,
      caminhos.size,
      caminhos.size - naoVistos.length,
      naoVistos.length,
      comLoja.length,
    ],
  );

  // --- 2ª parte: o contador cego -------------------------------------------
  const amostra = await montarAmostra(RAPIDA ? 5 : 25);
  console.log(`\nContador cego: ${amostra.length} páginas de amostra`);
  const achados: Achado[] = [];
  for (const pag of amostra) {
    const a = await contarPagina(pag);
    if (a) achados.push(a);
    await sleep(DELAY);
  }
  const mostra = achados.reduce((s, a) => s + a.mostra, 0);
  const temos = achados.reduce((s, a) => s + a.temos, 0);
  const buracos = achados.filter((a) => a.mostra - a.temos >= 3).sort((a, b) => b.mostra - b.temos - (a.mostra - a.temos));
  // Páginas onde nem o padrão largo enxergou os links: sinal de que o formato
  // dos endereços mudou de novo.
  const cegas = achados.filter((a) => a.cartoes >= 8 && a.mostra < a.cartoes * 0.5);

  console.log(`  as páginas mostram ${mostra} produtos · temos ${temos} · faltam ${mostra - temos}`);
  buracos.slice(0, 8).forEach((a) => console.log(`  BURACO ${a.pagina}: mostra ${a.mostra}, temos ${a.temos}`));
  cegas.forEach((a) => console.log(`  NÃO ENTENDI OS LINKS de ${a.pagina}: ${a.cartoes} cartões, só ${a.mostra} links lidos`));

  if (cegas.length) {
    await registrar(
      "erro",
      `o formato dos endereços da fonte pode ter mudado: em ${cegas.length} página(s) vejo os cartões de produto mas não consigo ler os links ` +
        `(ex.: ${cegas[0].pagina}, ${cegas[0].cartoes} cartões e só ${cegas[0].mostra} links). O coletor pode estar perdendo produto.`,
    );
  } else if (mostra - temos >= 15) {
    await registrar(
      "suspeitas",
      `contador cego: numa amostra de ${achados.length} páginas da fonte faltam ${mostra - temos} de ${mostra} produtos. ` +
        `Piores: ${buracos.slice(0, 5).map((a) => `${a.pagina} (${a.mostra - a.temos})`).join(", ")}`,
    );
  } else {
    console.log("  contador cego: nada relevante faltando");
  }

  if (comLoja.length) {
    await registrar(
      "suspeitas",
      `${comLoja.length} produto(s) estão à venda na fonte e faltam aqui: ${comLoja.slice(0, 8).join(", ")}` +
        (comLoja.length > 8 ? ` e mais ${comLoja.length - 8}` : ""),
    );
  } else {
    // No modo rápido só uma parte foi conferida — dizer "os N que faltam"
    // seria mentira. O texto tem que deixar claro o que foi olhado.
    const olhados = RAPIDA && conferir.length < naoVistos.length
      ? `Conferi ${conferir.length} dos ${naoVistos.length} não visitados e ${semLoja} não têm loja vendendo`
      : `Os ${semLoja} que faltam não têm loja vendendo (páginas de histórico)`;
    await registrar(
      "ok",
      `${caminhos.size} produtos na fonte, ${caminhos.size - naoVistos.length} já visitados. ` +
        `${olhados}. Nada faltando. ${minutos} min` +
        (semResposta ? ` · ${semResposta} páginas não responderam` : ""),
    );
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.query(
      "INSERT INTO watchdog_log (target, status, detail, action) VALUES ('auditoria', 'erro', ?, 'nenhuma')",
      [String((e as Error).message).slice(0, 500)],
    );
    await pool.end();
  } catch {
    /* banco fora do ar */
  }
  process.exit(1);
});
