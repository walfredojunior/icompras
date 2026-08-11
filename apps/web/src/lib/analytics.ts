import { headers } from "next/headers";
import { pool } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Medição de audiência.
//
// Só contagens agregadas por dia — nada de IP nem de identificador pessoal.
// O país vem do cabeçalho CF-IPCountry, que a Cloudflare envia em toda
// requisição (verificado em produção).

const ROBOS =
  /bot|crawler|spider|crawling|slurp|facebookexternalhit|whatsapp|telegram|preview|monitor|curl|wget|python-requests|headless|lighthouse|pingdom|uptime/i;

export type PageKind = "home" | "produto" | "categoria" | "loja" | "busca";

interface Visitante {
  country: string;
  device: "mobile" | "desktop" | "other";
  robo: boolean;
}

async function visitante(): Promise<Visitante> {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const pais = (h.get("cf-ipcountry") ?? "XX").toUpperCase().slice(0, 2);
  return {
    country: /^[A-Z]{2}$/.test(pais) ? pais : "XX",
    device: /iphone|android|ipad|mobile|ipod/i.test(ua)
      ? "mobile"
      : /windows|macintosh|linux|cros/i.test(ua)
        ? "desktop"
        : "other",
    robo: !ua || ROBOS.test(ua),
  };
}

// Registra uma visita. Nunca lança erro nem atrasa a página: se a medição
// falhar, a página tem que abrir do mesmo jeito.
export async function registrarVisita(kind: PageKind, slug: string): Promise<void> {
  try {
    const v = await visitante();
    if (v.robo) return; // robô de busca não é visita
    await pool.query(
      `INSERT INTO analytics_daily (day, hour, country, device, views)
       VALUES (CURDATE(), HOUR(NOW()), ?, ?, 1)
       ON DUPLICATE KEY UPDATE views = views + 1`,
      [v.country, v.device],
    );
    await pool.query(
      `INSERT INTO analytics_page (day, kind, slug, views) VALUES (CURDATE(), ?, ?, 1)
       ON DUPLICATE KEY UPDATE views = views + 1`,
      [kind, slug.slice(0, 200)],
    );
  } catch {
    /* medição nunca derruba o site */
  }
}

// Registra uma busca e quantos resultados ela devolveu.
export async function registrarBusca(termo: string, resultados: number): Promise<void> {
  const t = termo.trim().toLowerCase().slice(0, 160);
  if (!t) return;
  try {
    const v = await visitante();
    if (v.robo) return;
    await pool.query(
      `INSERT INTO analytics_search (day, term, searches, last_results) VALUES (CURDATE(), ?, 1, ?)
       ON DUPLICATE KEY UPDATE searches = searches + 1, last_results = VALUES(last_results)`,
      [t, resultados],
    );
  } catch {
    /* idem */
  }
}

// Registra que mandamos um visitante para a loja.
export async function registrarCliqueLoja(storeId: number, target: "site" | "whatsapp"): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO analytics_store_click (day, store_id, target, clicks) VALUES (CURDATE(), ?, ?, 1)
       ON DUPLICATE KEY UPDATE clicks = clicks + 1`,
      [storeId, target],
    );
  } catch {
    /* idem */
  }
}

// Registra um clique num banner.
//
// Diferente do clique de loja, este DESCARTA robô: é o número que vai ser
// mostrado a quem pagou pelo banner, então inflar com visita de rastreador
// seria vender fumaça. (A rota /ir/ já está fora do robots.txt, mas nem todo
// robô obedece.)
export async function registrarCliqueBanner(bannerId: number): Promise<void> {
  try {
    const v = await visitante();
    if (v.robo) return;
    await pool.query(
      `INSERT INTO analytics_banner_click (day, banner_id, clicks) VALUES (CURDATE(), ?, 1)
       ON DUPLICATE KEY UPDATE clicks = clicks + 1`,
      [bannerId],
    );
  } catch {
    /* idem */
  }
}

// ---------------------------------------------------------------------------
// Leitura para o painel
// ---------------------------------------------------------------------------

export interface Resumo {
  dias: Array<{ day: string; views: number }>;
  totalPeriodo: number;
  totalAnterior: number;
  paises: Array<{ country: string; views: number }>;
  dispositivos: Array<{ device: string; views: number }>;
  produtos: Array<{ slug: string; name: string; views: number }>;
  categorias: Array<{ slug: string; name: string; views: number }>;
  buscas: Array<{ term: string; searches: number; last_results: number }>;
  semResultado: Array<{ term: string; searches: number }>;
  lojas: Array<{ name: string; slug: string; clicks: number }>;
  /** Já convertido para a hora do Paraguai — ver `PARA_HORA_LOCAL`. */
  horas: Array<{ hour: number; views: number }>;
  totalCliques: number;
}

// ---------------------------------------------------------------------------
// A HORA GRAVADA É UTC; A HORA MOSTRADA TEM DE SER A DAQUI
// ---------------------------------------------------------------------------
//
// Achado em 11/08/2026, o dono reportando que "horários de maior movimento não
// está funcionando". Os números estavam certos — o RÓTULO é que estava errado,
// que é o pior tipo de defeito porque a tela parece funcionar.
//
// A visita é gravada com `HOUR(NOW())` e o servidor está em `Etc/UTC`. O
// gráfico então apontava pico "à meia-noite" (1.917 visitas às 0h, 1.890 à 1h).
// Ninguém pesquisa preço de celular às 2 da manhã. Convertido, o pico é às
// **20h** — gente olhando preço depois do trabalho, que é o esperado.
//
// ⚠ O efeito era prático, não cosmético: a legenda do gráfico sugere "bom
// momento para o robô coletor pegar leve". Seguindo o rótulo errado, o dono
// pouparia o site às 3 da manhã (vazio) e o deixaria a todo vapor às 20h, no
// pico de verdade.
//
// ⚠ **−3, e não −4.** Eu ia usar −4 pelo fuso histórico do Paraguai; ele
// corrigiu: "o Paraguai tá mesmo horário do Brasil e não vai mudar". Hoje o
// país não usa mais horário de verão, então é fixo.
//
// Guardamos em UTC de propósito — é o certo para dado bruto. Quem traduz é a
// apresentação, e assim os 13 dias já gravados aparecem certos também, sem
// emenda no meio do histórico.
const PARA_HORA_LOCAL = Number(process.env.FUSO_LOCAL_HORAS ?? -3);

/**
 * Reagrupa as horas de UTC para a hora local.
 *
 * ⚠ Uma hora que atravessa a meia-noite muda de DIA, e isto não corrige isso —
 * só o balde da hora. Para este gráfico é irrelevante: ele soma o período
 * inteiro, então o desvio se limita às três primeiras horas do primeiro dia da
 * janela. Corrigir de verdade exigiria guardar o instante, não (dia, hora).
 */
function paraHoraLocal(linhas: Array<{ hour: number; views: number }>) {
  const balde = new Array<number>(24).fill(0);
  for (const l of linhas) {
    balde[(((l.hour + PARA_HORA_LOCAL) % 24) + 24) % 24] += l.views;
  }
  return balde.map((views, hour) => ({ hour, views })).filter((x) => x.views > 0);
}

export async function getResumo(dias = 30): Promise<Resumo> {
  const d = Math.max(1, Math.min(365, dias));

  const porDia = await pool.query(
    `SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, SUM(views) AS views
       FROM analytics_daily WHERE day > CURDATE() - INTERVAL ? DAY
      GROUP BY day ORDER BY day`,
    [d],
  );
  const [tot] = await pool.query(
    `SELECT COALESCE(SUM(views),0) n FROM analytics_daily WHERE day > CURDATE() - INTERVAL ? DAY`,
    [d],
  );
  const [ant] = await pool.query(
    `SELECT COALESCE(SUM(views),0) n FROM analytics_daily
      WHERE day > CURDATE() - INTERVAL ? DAY AND day <= CURDATE() - INTERVAL ? DAY`,
    [d * 2, d],
  );

  const paises = await pool.query(
    `SELECT country, SUM(views) AS views FROM analytics_daily
      WHERE day > CURDATE() - INTERVAL ? DAY GROUP BY country ORDER BY views DESC LIMIT 8`,
    [d],
  );
  const dispositivos = await pool.query(
    `SELECT device, SUM(views) AS views FROM analytics_daily
      WHERE day > CURDATE() - INTERVAL ? DAY GROUP BY device ORDER BY views DESC`,
    [d],
  );

  const produtos = await pool.query(
    `SELECT a.slug, COALESCE(p.canonical_name, a.slug) AS name, SUM(a.views) AS views
       FROM analytics_page a LEFT JOIN product p ON p.slug = a.slug
      WHERE a.kind = 'produto' AND a.day > CURDATE() - INTERVAL ? DAY
      GROUP BY a.slug ORDER BY views DESC LIMIT 10`,
    [d],
  );
  const categorias = await pool.query(
    `SELECT a.slug, COALESCE(ct.name, a.slug) AS name, SUM(a.views) AS views
       FROM analytics_page a
       LEFT JOIN category c ON c.slug = a.slug
       LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = 'pt-BR'
      WHERE a.kind = 'categoria' AND a.day > CURDATE() - INTERVAL ? DAY
      GROUP BY a.slug ORDER BY views DESC LIMIT 10`,
    [d],
  );

  const buscas = await pool.query(
    `SELECT term, SUM(searches) AS searches, MIN(last_results) AS last_results
       FROM analytics_search WHERE day > CURDATE() - INTERVAL ? DAY
      GROUP BY term ORDER BY searches DESC LIMIT 12`,
    [d],
  );
  const semResultado = await pool.query(
    `SELECT term, SUM(searches) AS searches FROM analytics_search
      WHERE day > CURDATE() - INTERVAL ? DAY AND last_results = 0
      GROUP BY term ORDER BY searches DESC LIMIT 12`,
    [d],
  );

  const lojas = await pool.query(
    `SELECT s.name, s.slug, SUM(a.clicks) AS clicks
       FROM analytics_store_click a JOIN store s ON s.id = a.store_id
      WHERE a.day > CURDATE() - INTERVAL ? DAY
      GROUP BY s.id ORDER BY clicks DESC LIMIT 10`,
    [d],
  );
  const [cliq] = await pool.query(
    `SELECT COALESCE(SUM(clicks),0) n FROM analytics_store_click WHERE day > CURDATE() - INTERVAL ? DAY`,
    [d],
  );

  const horas = await pool.query(
    `SELECT hour, SUM(views) AS views FROM analytics_daily
      WHERE day > CURDATE() - INTERVAL ? DAY GROUP BY hour ORDER BY hour`,
    [d],
  );

  const num = (v: unknown) => Number(v ?? 0);
  return {
    dias: porDia.map((r: any) => ({ day: r.day, views: num(r.views) })),
    totalPeriodo: num(tot?.n),
    totalAnterior: num(ant?.n),
    paises: paises.map((r: any) => ({ country: r.country, views: num(r.views) })),
    dispositivos: dispositivos.map((r: any) => ({ device: r.device, views: num(r.views) })),
    produtos: produtos.map((r: any) => ({ slug: r.slug, name: r.name, views: num(r.views) })),
    categorias: categorias.map((r: any) => ({ slug: r.slug, name: r.name, views: num(r.views) })),
    buscas: buscas.map((r: any) => ({
      term: r.term,
      searches: num(r.searches),
      last_results: num(r.last_results),
    })),
    semResultado: semResultado.map((r: any) => ({ term: r.term, searches: num(r.searches) })),
    lojas: lojas.map((r: any) => ({ name: r.name, slug: r.slug, clicks: num(r.clicks) })),
    horas: paraHoraLocal(horas.map((r: any) => ({ hour: num(r.hour), views: num(r.views) }))),
    totalCliques: num(cliq?.n),
  };
}
