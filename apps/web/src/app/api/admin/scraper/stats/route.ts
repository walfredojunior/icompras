import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Painel do scraper — números ao vivo. Também serve de base para monitorar por API.
export async function GET(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }

  const locale = new URL(req.url).searchParams.get("locale") || "pt-BR";

  const totRow = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM product) AS products,
      (SELECT COUNT(*) FROM product WHERE specs IS NOT NULL) AS withSpecs,
      (SELECT COUNT(*) FROM product WHERE min_price_usd IS NOT NULL) AS withPrice,
      (SELECT COUNT(*) FROM offer) AS offers,
      (SELECT COUNT(*) FROM store) AS stores,
      (SELECT COUNT(*) FROM store WHERE phone IS NOT NULL) AS storesWithPhone,
      (SELECT MAX(last_crawled_at) FROM scrape_log) AS lastCrawlAt,
      (SELECT COUNT(*) FROM scrape_log WHERE last_crawled_at > NOW() - INTERVAL 5 MINUTE) AS crawled5m,
      (SELECT COUNT(*) FROM scrape_log WHERE last_crawled_at > NOW() - INTERVAL 1 HOUR) AS crawled1h,
      (SELECT COUNT(*) FROM scrape_log WHERE last_crawled_at > NOW() - INTERVAL 24 HOUR) AS crawled24h
  `);
  const t = totRow[0] ?? {};

  // Conta o grupo SOMANDO as subcategorias: desde a recategorização os
  // produtos ficam sempre numa subcategoria (celular, perfume, notebook…),
  // nunca direto na raiz — contar só a raiz dava zero em tudo.
  const byCategory = await pool.query(
    `SELECT COALESCE(ct.name, c.slug) AS name,
            (SELECT COUNT(*) FROM product p
               LEFT JOIN category sub ON sub.id = p.category_id
              WHERE p.category_id = c.id OR sub.parent_id = c.id) AS count
     FROM category c
     LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
     WHERE c.parent_id IS NULL
     HAVING count > 0
     ORDER BY count DESC`,
    [locale],
  );

  const recent = await pool.query(
    `SELECT p.canonical_name AS name, p.slug, p.updated_at AS updatedAt,
            (p.specs IS NOT NULL) AS hasSpecs, (p.min_price_usd IS NOT NULL) AS hasPrice,
            COALESCE(ct.name, c.slug) AS category
     FROM product p
     LEFT JOIN category c ON c.id = p.category_id
     LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
     ORDER BY p.updated_at DESC
     LIMIT 15`,
    [locale],
  );

  const ctlRow = await pool.query(
    `SELECT state, stop_requested, message, started_at, heartbeat_at,
            TIMESTAMPDIFF(SECOND, heartbeat_at, NOW()) AS beatAge,
            cycle, cycle_started_at, cycle_total, last_cycle_finished_at, last_cycle_seconds,
            TIMESTAMPDIFF(SECOND, cycle_started_at, NOW()) AS cycleAge
       FROM scrape_control WHERE id = 1`,
  );
  const c = ctlRow[0] ?? {};
  const isRunning = c.state && c.state !== "idle" && c.beatAge != null && Number(c.beatAge) < 30;
  const control = {
    state: c.state ?? "idle",
    running: !!isRunning,
    stopRequested: Number(c.stop_requested ?? 0) === 1,
    message: c.message ?? null,
    startedAt: c.started_at ? new Date(c.started_at).toISOString() : null,
    heartbeatAt: c.heartbeat_at ? new Date(c.heartbeat_at).toISOString() : null,
  };

  // Progresso da volta: categorias concluídas desde que a volta começou.
  // É a única medida exata que existe — o total de produtos do site é
  // desconhecido, então "faltam N produtos" seria chute.
  let cycle: any = null;
  try {
    const [d] = await pool.query(
      `SELECT COUNT(*) n FROM crawl_category
        WHERE last_finished_at IS NOT NULL
          AND last_finished_at >= (SELECT COALESCE(cycle_started_at, '1970-01-01') FROM scrape_control WHERE id = 1)`,
    );
    const total = Number(c.cycle_total ?? 0);
    const done = Math.min(Number(d.n ?? 0), total || Number(d.n ?? 0));
    const elapsed = c.cycleAge == null ? null : Number(c.cycleAge);
    // Estimativa de término pelo ritmo desta volta (declarada como estimativa).
    const etaSeconds = done > 0 && elapsed != null && total > done ? Math.round((elapsed / done) * (total - done)) : null;
    cycle = {
      number: Number(c.cycle ?? 1),
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
      startedAt: c.cycle_started_at ? new Date(c.cycle_started_at).toISOString() : null,
      elapsedSeconds: elapsed,
      etaSeconds,
      lastFinishedAt: c.last_cycle_finished_at ? new Date(c.last_cycle_finished_at).toISOString() : null,
      lastSeconds: c.last_cycle_seconds == null ? null : Number(c.last_cycle_seconds),
    };
  } catch {
    /* banco ainda sem as colunas de ciclo */
  }

  const lastCrawl = t.lastCrawlAt ? new Date(t.lastCrawlAt).toISOString() : null;

  // Guardião: última verificação e acontecimentos recentes.
  // Tolerante a banco ainda sem as tabelas (o painel não pode quebrar por isso).
  let w: any = {};
  let wEvents: any[] = [];
  let wAudit: any = null;
  try {
    const wsRow = await pool.query(
      "SELECT last_check_at, status, detail, checks, TIMESTAMPDIFF(SECOND, last_check_at, NOW()) AS age FROM watchdog_state WHERE id = 1",
    );
    w = wsRow[0] ?? {};
    wEvents = await pool.query(
      "SELECT happened_at, target, status, detail, action FROM watchdog_log ORDER BY happened_at DESC LIMIT 8",
    );
    // Última auditoria de cobertura do catálogo (roda domingo de madrugada).
    // Vem à parte porque o resultado é uma frase longa: na lista de
    // acontecimentos ela apareceria cortada, e é justamente o texto que
    // interessa ler — quais categorias estão rendendo produto na fonte e nada aqui.
    const aRow = await pool.query(
      "SELECT happened_at, status, detail FROM watchdog_log WHERE target = 'auditoria' AND status <> 'iniciada' ORDER BY happened_at DESC LIMIT 1",
    );
    if (aRow.length) {
      wAudit = {
        at: aRow[0].happened_at ? new Date(aRow[0].happened_at).toISOString() : null,
        status: aRow[0].status,
        detail: aRow[0].detail,
      };
    }
  } catch {
    /* guardião ainda não instalado */
  }
  // Cobertura do catálogo: quanto do que existe na fonte já está aqui.
  // Vem do mapa do site, atualizado pelo coletor ao fim de cada volta (~4h).
  let cobertura: any = null;
  try {
    // `cov` e não `c`: já existe um `c` acima (o controle do coletor) e
    // sombrear o nome aqui dentro só convida a erro na próxima edição.
    const [cov] = await pool.query(
      `SELECT checked_at, source_total, seen_total, missing_total, missing_sellable, status, detail,
              TIMESTAMPDIFF(SECOND, checked_at, NOW()) AS age
         FROM catalog_coverage WHERE id = 1`,
    );
    if (cov?.checked_at) {
      cobertura = {
        at: new Date(cov.checked_at).toISOString(),
        ageSeconds: cov.age == null ? null : Number(cov.age),
        source: Number(cov.source_total),
        seen: Number(cov.seen_total),
        missing: Number(cov.missing_total),
        missingSellable: cov.missing_sellable == null ? null : Number(cov.missing_sellable),
        status: cov.status,
        detail: cov.detail,
      };
    }
  } catch {
    /* banco ainda sem a tabela */
  }

  // Freios: quantas vezes a fonte mandou o coletor esperar.
  // É o termômetro de quanto estamos incomodando — enquanto ficar em zero, o
  // ritmo está confortável para ela.
  let freios: any = null;
  try {
    const [f] = await pool.query(
      `SELECT COUNT(*) total,
              SUM(happened_at > NOW() - INTERVAL 24 HOUR) hoje,
              SUM(happened_at > NOW() - INTERVAL 7 DAY)   semana,
              COALESCE(SUM(CASE WHEN happened_at > NOW() - INTERVAL 24 HOUR THEN espera_ms END), 0) espera24h,
              MAX(happened_at) ultimo
         FROM crawl_freio`,
    );
    freios = {
      total: Number(f?.total ?? 0),
      hoje: Number(f?.hoje ?? 0),
      semana: Number(f?.semana ?? 0),
      // Quanto tempo o coletor passou parado por ordem da fonte, em segundos.
      paradoSegundos24h: Math.round(Number(f?.espera24h ?? 0) / 1000),
      ultimoAt: f?.ultimo ? new Date(f.ultimo).toISOString() : null,
    };
  } catch {
    /* banco ainda sem a tabela */
  }

  const watchdog = {
    enabled: w.last_check_at != null,
    lastCheckAt: w.last_check_at ? new Date(w.last_check_at).toISOString() : null,
    ageSeconds: w.age == null ? null : Number(w.age),
    status: w.status ?? null,
    detail: w.detail ?? null,
    checks: Number(w.checks ?? 0),
    audit: wAudit,
    coverage: cobertura,
    brakes: freios,
    events: wEvents.map((e: any) => ({
      at: e.happened_at ? new Date(e.happened_at).toISOString() : null,
      target: e.target,
      status: e.status,
      detail: e.detail,
      action: e.action,
    })),
  };

  return NextResponse.json({
    control,
    cycle,
    watchdog,
    products: Number(t.products ?? 0),
    withSpecs: Number(t.withSpecs ?? 0),
    withPrice: Number(t.withPrice ?? 0),
    offers: Number(t.offers ?? 0),
    stores: Number(t.stores ?? 0),
    storesWithPhone: Number(t.storesWithPhone ?? 0),
    crawled5m: Number(t.crawled5m ?? 0),
    crawled1h: Number(t.crawled1h ?? 0),
    crawled24h: Number(t.crawled24h ?? 0),
    lastCrawlAt: lastCrawl,
    byCategory: byCategory.map((r: any) => ({ name: r.name, count: Number(r.count) })),
    recent: recent.map((r: any) => ({
      name: r.name,
      slug: r.slug,
      category: r.category,
      hasSpecs: Number(r.hasSpecs) === 1,
      hasPrice: Number(r.hasPrice) === 1,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
    })),
  });
}
