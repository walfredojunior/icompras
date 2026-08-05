"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, Tag, ListChecks, Store, Phone, RefreshCw, Play, Square, ShieldCheck } from "lucide-react";

interface Recent {
  name: string;
  slug: string;
  category: string;
  hasSpecs: boolean;
  hasPrice: boolean;
  updatedAt: string | null;
}
interface Control {
  state: string; // idle | running | stopping
  running: boolean;
  stopRequested: boolean;
  message: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
}
interface WatchdogEvent {
  at: string | null;
  target: string;
  status: string;
  detail: string | null;
  action: string | null;
}
interface Watchdog {
  enabled: boolean;
  lastCheckAt: string | null;
  ageSeconds: number | null;
  status: string | null;
  detail: string | null;
  checks: number;
  audit: { at: string | null; status: string; detail: string | null } | null;
  coverage: Coverage | null;
  brakes: Brakes | null;
  events: WatchdogEvent[];
}
interface Brakes {
  total: number;
  hoje: number;
  semana: number;
  /** 429 — "você está pedindo rápido demais". É sobre nós. */
  ritmo24h: number;
  ritmoTotal: number;
  /** 503 — "estou sobrecarregado/fora do ar". É sobre a fonte. */
  fora24h: number;
  paradoSegundos24h: number;
  ultimoAt: string | null;
}
interface Coverage {
  at: string;
  ageSeconds: number | null;
  source: number;
  seen: number;
  missing: number;
  missingSellable: number | null;
  status: string;
  detail: string | null;
}
interface Cycle {
  number: number;
  total: number;
  done: number;
  percent: number;
  startedAt: string | null;
  elapsedSeconds: number | null;
  etaSeconds: number | null;
  lastFinishedAt: string | null;
  lastSeconds: number | null;
}
interface Stats {
  control: Control;
  cycle?: Cycle | null;
  watchdog?: Watchdog;
  products: number;
  withSpecs: number;
  withPrice: number;
  offers: number;
  stores: number;
  storesWithPhone: number;
  crawled5m: number;
  crawled1h: number;
  crawled24h: number;
  lastCrawlAt: string | null;
  byCategory: Array<{ name: string; count: number }>;
  recent: Recent[];
}

function ago(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

// Cores da barra de progresso, uma por volta. A cor muda a cada volta nova
// para dar de relance a informação "ele reiniciou" — sem isso, voltar ao
// painel e ver 50% pode ser tanto "travou" quanto "recomeçou".
// Sem vermelho de propósito: vermelho tem que significar problema.
const CORES_VOLTA = [
  { nome: "verde", barra: "#2fa043", fundo: "#e7f5ea" },
  { nome: "azul", barra: "#2563eb", fundo: "#e6edfd" },
  { nome: "roxo", barra: "#7c3aed", fundo: "#efe8fd" },
  { nome: "laranja", barra: "#f97316", fundo: "#fdeee1" },
  { nome: "azul-petróleo", barra: "#0d9488", fundo: "#e0f2f0" },
  { nome: "âmbar", barra: "#b45309", fundo: "#f8ecdd" },
];

function duracao(seg: number | null): string {
  if (seg == null) return "—";
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h${String(m % 60).padStart(2, "0")}`;
}

function CycleBar({ c, locale }: { c?: Cycle | null; locale: string }) {
  if (!c || !c.total) return null;
  const cor = CORES_VOLTA[(c.number - 1 + CORES_VOLTA.length) % CORES_VOLTA.length];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cor.barra }} />
          <span className="font-semibold text-slate-900">Volta nº {c.number}</span>
          <span className="text-xs text-slate-400">({cor.nome})</span>
        </div>
        <span className="text-sm font-medium text-slate-700">
          {c.percent}% · {c.done.toLocaleString(locale)} de {c.total.toLocaleString(locale)} categorias
        </span>
      </div>

      <div className="mt-3 h-3 overflow-hidden rounded-full" style={{ backgroundColor: cor.fundo }}>
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(c.percent, 1)}%`, backgroundColor: cor.barra }}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>rodando há {duracao(c.elapsedSeconds)}</span>
        {c.etaSeconds != null && <span>faltam ~{duracao(c.etaSeconds)} (estimativa)</span>}
        {c.lastSeconds != null && (
          <span>
            volta anterior: {duracao(c.lastSeconds)}
            {c.lastFinishedAt ? `, terminou ${ago(c.lastFinishedAt)}` : ""}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        A cor muda a cada volta nova — se você voltar aqui e a cor estiver diferente, ele já recomeçou.
      </p>
    </div>
  );
}

// Quantas vezes a fonte mandou o coletor esperar.
//
// Até 02/08/2026 o coletor IGNORAVA o pedido — seguia no mesmo ritmo, que é
// como um aviso vira bloqueio. Agora ele obedece, e este número é o termômetro
// de quanto estamos incomodando: enquanto ficar em zero, o ritmo está
// confortável para a fonte. Se começar a subir, é hora de baixar o ritmo antes
// que alguém do outro lado repare.
function FreiosLinha({ b }: { b: Brakes | null }) {
  if (!b || b.total === 0) {
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="font-medium text-slate-700">Freios da fonte</span>
          <span className="font-medium text-brand-green-dark">nenhum</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          O Compras Paraguai nunca pediu para o coletor desacelerar. O ritmo está confortável para ele.
        </p>
      </div>
    );
  }
  const parado =
    b.paradoSegundos24h >= 60
      ? `${Math.round(b.paradoSegundos24h / 60)} min`
      : `${b.paradoSegundos24h}s`;

  // A cor sai SÓ do 429. Um dia cheio de 503 é notícia sobre a fonte, não
  // motivo de alarme aqui — pintar de âmbar por causa deles fazia o painel
  // gritar por algo que não temos como resolver (e foi o que aconteceu).
  const nossoProblema = b.ritmo24h > 0;
  const cor = nossoProblema
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className={`mt-3 rounded-xl border p-3 ${cor}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-medium text-slate-700">Freios da fonte</span>
        <span className="text-slate-400">{ago(b.ultimoAt)}</span>
      </div>

      <div className="mt-1.5 space-y-1 text-xs leading-relaxed">
        <p>
          <span className="font-medium">Pedimos rápido demais:</span>{" "}
          {b.ritmo24h === 0 ? (
            <span className="font-medium text-brand-green-dark">nenhuma vez nas últimas 24h</span>
          ) : (
            <span className="font-medium text-amber-700">
              {b.ritmo24h} vez{b.ritmo24h === 1 ? "" : "es"} nas últimas 24h
            </span>
          )}
          {b.ritmo24h >= 10 ? " — convém baixar o ritmo do coletor." : ""}
        </p>
        <p>
          <span className="font-medium">A fonte esteve fora do ar:</span> {b.fora24h} vez
          {b.fora24h === 1 ? "" : "es"} nas últimas 24h
          {b.paradoSegundos24h > 0 ? `, somando ${parado} de espera` : ""}. Isso é problema do lado
          deles; o coletor só aguarda e continua.
        </p>
        <p className="text-slate-500">
          Na semana: {b.semana}. Total desde sempre: {b.total} ({b.ritmoTotal} por ritmo).
        </p>
      </div>
    </div>
  );
}

// Cobertura do catálogo, sempre à vista.
//
// Responde de bate-pronto a pergunta que o dono do site já fez três vezes:
// "está faltando produto?". O número vem do mapa do site da fonte — a lista que
// ela publica para os buscadores — e o coletor o atualiza ao fim de cada volta.
//
// O que importa NÃO é "faltando", e sim "faltando E à venda": a fonte mantém no
// ar centenas de páginas de produto que nenhuma loja vende mais, só pelo
// histórico de preço. Contá-las como falta seria alarme falso todo dia.
function CoberturaLinha({ c }: { c: Coverage | null }) {
  if (!c) {
    return (
      <p className="mt-3 text-xs text-slate-400">
        Cobertura do catálogo — o coletor calcula ao fim da próxima volta.
      </p>
    );
  }
  const quebrado = c.status === "mapa-inacessivel" || c.status === "mapa-suspeito";
  const faltando = c.status === "faltando" || (c.missingSellable ?? 0) > 0;
  const cor = quebrado
    ? "border-red-200 bg-red-50"
    : faltando
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-slate-50";
  const pct = c.source > 0 ? Math.min(100, (c.seen / c.source) * 100) : 0;

  return (
    <div className={`mt-3 rounded-xl border p-3 ${cor}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-medium text-slate-700">Cobertura do catálogo</span>
        {quebrado ? (
          <span className="font-medium text-red-700">
            {c.status === "mapa-inacessivel" ? "não consegui ler a lista da fonte" : "a lista da fonte veio estranha"}
          </span>
        ) : faltando ? (
          <span className="font-medium text-amber-700">
            {c.missingSellable ?? c.missing} à venda na fonte e faltando aqui
          </span>
        ) : (
          <span className="font-medium text-brand-green-dark">nada faltando</span>
        )}
        <span className="text-slate-400">{ago(c.at)}</span>
      </div>

      {!quebrado && (
        <>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${faltando ? "bg-amber-500" : "bg-brand-green"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {c.seen.toLocaleString("pt-BR")} de {c.source.toLocaleString("pt-BR")} produtos que a fonte publica
            {c.missing > 0 && c.missingSellable === 0
              ? ` · os ${c.missing.toLocaleString("pt-BR")} restantes não têm loja vendendo`
              : ""}
          </p>
        </>
      )}
      {quebrado && c.detail ? <p className="mt-1 text-xs leading-relaxed text-red-800">{c.detail}</p> : null}
    </div>
  );
}

// Resultado da última auditoria de cobertura do catálogo (domingo de madrugada).
//
// Nasceu de dois sustos: a categoria "games" ficou meses sem ser coletada por
// um engano numa lista de bloqueio, e antes disso 377 categorias voltavam
// vazias por um bug. Nos dois casos o painel dizia que estava tudo bem — os
// números subiam, a coleta "terminava com sucesso" e mesmo assim faltava
// catálogo. Por isso esta linha existe: é o único lugar que compara o que a
// fonte tem com o que nós temos.
function AuditoriaLinha({ a }: { a: Watchdog["audit"] }) {
  if (!a) {
    return (
      <p className="mt-3 text-xs text-slate-400">
        Auditoria do catálogo — primeira rodada no próximo domingo de madrugada.
      </p>
    );
  }
  const limpo = a.status === "ok";
  return (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        limpo ? "border-slate-200 bg-slate-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-medium text-slate-700">Auditoria do catálogo</span>
        <span className={limpo ? "font-medium text-brand-green-dark" : "font-medium text-amber-700"}>
          {limpo ? "nada faltando" : "achou categoria faltando"}
        </span>
        <span className="text-slate-400">{ago(a.at)}</span>
      </div>
      {/* Sem truncar: quando acha algo, o texto lista as categorias e é
          exatamente isso que precisa ser lido. */}
      {a.detail ? (
        <p className={`mt-1 text-xs leading-relaxed ${limpo ? "text-slate-500" : "text-amber-800"}`}>{a.detail}</p>
      ) : null}
    </div>
  );
}

// O guardião confere o coletor e o site de poucos em poucos minutos e religa
// o que travar. Aqui o dono do site vê, num olhar, se está tudo sob controle.
function WatchdogCard({ w }: { w?: Watchdog }) {
  if (!w?.enabled) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <span className="font-medium text-slate-700">Guardião</span> — ainda não está rodando.
      </div>
    );
  }
  // Se o próprio guardião ficar mudo por muito tempo, isso também é um aviso.
  const mudo = w.ageSeconds != null && w.ageSeconds > 1800;
  const ok = w.status === "ok" && !mudo;
  const cor = ok ? "text-brand-green-dark" : "text-amber-600";
  const rotulo = mudo
    ? "Guardião sem responder"
    : w.status === "ok"
      ? "Tudo certo"
      : w.status === "parado-pelo-usuario"
        ? "Coletor parado por você"
        : `Atenção: ${w.status}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-4 w-4 ${cor}`} />
          <span className="font-semibold text-slate-900">Guardião</span>
          <span className={`text-sm font-medium ${cor}`}>{rotulo}</span>
        </div>
        <span className="text-xs text-slate-400">
          verificado {ago(w.lastCheckAt)} · {w.checks.toLocaleString()} verificações
        </span>
      </div>
      {w.detail ? <p className="mt-2 text-xs text-slate-500">{w.detail}</p> : null}

      <CoberturaLinha c={w.coverage} />
      <FreiosLinha b={w.brakes} />
      <AuditoriaLinha a={w.audit} />

      {w.events.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 text-xs font-medium text-slate-400">Acontecimentos</div>
          <ul className="space-y-1.5">
            {w.events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="text-slate-400">{ago(e.at)}</span>
                <span className="font-medium text-slate-700">{e.target}</span>
                {/* Nem todo acontecimento é problema: "iniciada" e "ok" são
                    rotina e não devem acender alerta amarelo. */}
                <span className={e.status === "ok" || e.status === "iniciada" ? "text-slate-500" : "text-amber-700"}>
                  {e.status}
                </span>
                {e.action && e.action !== "nenhuma" ? (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{e.action}</span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-slate-500">{e.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ScraperDashboard({ locale }: { locale: string }) {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/scraper/stats?locale=${locale}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      setS(await r.json());
      setError(false);
      setTick(new Date().toLocaleTimeString(locale));
    } catch {
      setError(true);
    }
  }, [locale]);

  const control = useCallback(
    async (action: "start" | "stop") => {
      setBusy(true);
      try {
        await fetch("/api/admin/scraper/control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  if (!s) {
    return <p className="text-slate-500">{error ? "Erro ao carregar." : "Carregando…"}</p>;
  }

  const ctl = s.control;
  const active = ctl.running;
  const stopping = ctl.state === "stopping";
  const statusLabel = stopping ? "Parando…" : active ? "Crawler ativo" : "Crawler parado";
  const maxCat = Math.max(1, ...s.byCategory.map((c) => c.count));

  const cards = [
    { label: "Produtos", value: s.products, Icon: Boxes, color: "text-brand-navy" },
    { label: "Com preço", value: s.withPrice, Icon: Tag, color: "text-brand-green-dark" },
    { label: "Com especificações", value: s.withSpecs, Icon: ListChecks, color: "text-brand-green-dark" },
    { label: "Ofertas (loja × preço)", value: s.offers, Icon: Tag, color: "text-brand-navy" },
    { label: "Lojas", value: s.stores, Icon: Store, color: "text-brand-navy" },
    { label: "Lojas com telefone", value: s.storesWithPhone, Icon: Phone, color: "text-brand-green-dark" },
  ];

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className={`relative flex h-3 w-3`}>
            {active && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-green opacity-75" />
            )}
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${active ? "bg-brand-green" : "bg-slate-300"}`}
            />
          </span>
          <div>
            <div className="font-semibold text-slate-900">{statusLabel}</div>
            <div className="text-xs text-slate-500">
              {ctl.message ? <span className="text-slate-600">{ctl.message} · </span> : null}
              última atividade {ago(s.lastCrawlAt)} · {s.crawled5m} nos últimos 5min · {s.crawled1h}/h ·{" "}
              {s.crawled24h}/24h
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {active || stopping ? (
            <button
              onClick={() => control("stop")}
              disabled={busy || stopping}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Square className="h-4 w-4" />
              {stopping ? "Parando…" : "Parar"}
            </button>
          ) : (
            <button
              onClick={() => control("start")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
            >
              <Play className="h-4 w-4" />
              Iniciar
            </button>
          )}
          <button
            onClick={load}
            title={tick ? `atualizado ${tick}` : "atualizar"}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:border-slate-300 hover:text-brand-navy"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progresso da volta */}
      <CycleBar c={s.cycle} locale={locale} />

      {/* Guardião */}
      <WatchdogCard w={s.watchdog} />

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Icon className={`h-4 w-4 ${color}`} />
              {label}
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{value.toLocaleString(locale)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Por categoria */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Produtos por categoria</h3>
          {s.byCategory.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda sem dados.</p>
          ) : (
            <div className="space-y-2">
              {s.byCategory.map((c) => (
                <div key={c.name}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{c.name}</span>
                    <span className="font-medium">{c.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-brand-green"
                      style={{ width: `${(c.count / maxCat) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimas atualizações */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Últimos produtos atualizados</h3>
          {s.recent.length === 0 ? (
            <p className="text-sm text-slate-400">Ainda sem dados.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {s.recent.map((r) => (
                <li key={r.slug} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <a
                      href={`/${locale}/produto/${r.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm text-slate-800 hover:text-brand-navy hover:underline"
                    >
                      {r.name}
                    </a>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{r.category}</span>
                      {r.hasPrice && <span className="text-brand-green-dark">· preço</span>}
                      {r.hasSpecs && <span className="text-brand-green-dark">· specs</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400">{ago(r.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Dados ao vivo via <code className="rounded bg-slate-100 px-1">/api/admin/scraper/stats</code> — o mesmo
        endpoint poderá ser usado para monitorar por API no futuro.
      </p>
    </div>
  );
}
