import type { Resumo } from "@/lib/analytics";

// Gráficos do painel de audiência.
//
// Tudo desenhado em SVG/HTML puro — sem biblioteca de gráficos, para não
// pesar o painel. Cores: paleta categórica validada (contraste e daltonismo
// conferidos); barras finas com ponta arredondada e SEMPRE com o número
// escrito ao lado, porque a cor sozinha nunca deve carregar a informação.

const PAIS_NOME: Record<string, string> = {
  BR: "Brasil",
  PY: "Paraguai",
  AR: "Argentina",
  US: "Estados Unidos",
  PT: "Portugal",
  UY: "Uruguai",
  CL: "Chile",
  XX: "Desconhecido",
};

const CORES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)"];

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}

// ---------------------------------------------------------------------------
// Número de destaque
// ---------------------------------------------------------------------------
export function Destaque({
  rotulo,
  valor,
  variacao,
  sufixo,
}: {
  rotulo: string;
  valor: number;
  variacao?: number | null;
  sufixo?: string;
}) {
  const sobe = variacao != null && variacao > 0;
  const desce = variacao != null && variacao < 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-400">{rotulo}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900">{fmt(valor)}</span>
        {sufixo ? <span className="text-xs text-slate-400">{sufixo}</span> : null}
        {variacao != null && (
          <span className={`text-xs font-medium ${sobe ? "text-emerald-600" : desce ? "text-slate-500" : "text-slate-400"}`}>
            {sobe ? "▲" : desce ? "▼" : "="} {Math.abs(variacao)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha: visitas por dia
// ---------------------------------------------------------------------------
export function LinhaVisitas({ dias }: { dias: Resumo["dias"] }) {
  if (dias.length < 2) {
    return <SemDados texto="Ainda não há dias suficientes para desenhar a linha." />;
  }
  const L = 60, R = 12, T = 12, B = 26, W = 720, H = 220;
  const max = Math.max(...dias.map((d) => d.views), 1);
  const px = (i: number) => L + (i * (W - L - R)) / Math.max(1, dias.length - 1);
  const py = (v: number) => T + (H - T - B) * (1 - v / max);

  const linha = dias.map((d, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(d.views).toFixed(1)}`).join(" ");
  const area = `${linha} L${px(dias.length - 1).toFixed(1)},${H - B} L${px(0).toFixed(1)},${H - B} Z`;
  const marcas = [0, Math.round(max / 2), max];
  const rotuloDia = (s: string) => s.slice(8) + "/" + s.slice(5, 7);

  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-5">
      <figcaption className="text-sm font-semibold text-slate-900">Visitas por dia</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Visitas por dia">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={L} x2={W - R} y1={py(m)} y2={py(m)} stroke="var(--grade)" strokeWidth="1" />
            <text x={L - 8} y={py(m) + 4} textAnchor="end" fontSize="11" fill="var(--texto-fraco)">
              {fmt(m)}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--serie-1)" opacity="0.12" />
        <path d={linha} fill="none" stroke="var(--serie-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {dias.map((d, i) => (
          <circle key={d.day} cx={px(i)} cy={py(d.views)} r="3.5" fill="var(--serie-1)">
            <title>{`${rotuloDia(d.day)} — ${fmt(d.views)} visitas`}</title>
          </circle>
        ))}
        {dias.map((d, i) =>
          i === 0 || i === dias.length - 1 || i === Math.floor(dias.length / 2) ? (
            <text key={`r${d.day}`} x={px(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--texto-fraco)">
              {rotuloDia(d.day)}
            </text>
          ) : null,
        )}
      </svg>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais com número sempre visível
// ---------------------------------------------------------------------------
export function Barras({
  titulo,
  itens,
  cor = 0,
  vazio = "Ainda sem dados.",
  destaqueAviso = false,
}: {
  titulo: string;
  itens: Array<{ rotulo: string; valor: number; extra?: string }>;
  cor?: number;
  vazio?: string;
  destaqueAviso?: boolean;
}) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-5">
      <figcaption className="text-sm font-semibold text-slate-900">{titulo}</figcaption>
      {itens.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{vazio}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {itens.map((i) => (
            <li key={i.rotulo} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-slate-700" title={i.rotulo}>
                  {destaqueAviso ? <span className="mr-1 text-amber-500">⚠</span> : null}
                  {i.rotulo}
                </span>
                <span className="shrink-0 font-medium text-slate-900">{fmt(i.valor)}</span>
                {i.extra ? <span className="shrink-0 text-xs text-slate-400">{i.extra}</span> : null}
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(2, (i.valor / max) * 100)}%`, backgroundColor: CORES[cor] }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Países — barras coloridas + legenda (identidade nunca só pela cor)
// ---------------------------------------------------------------------------
export function Paises({ paises }: { paises: Resumo["paises"] }) {
  const total = paises.reduce((n, p) => n + p.views, 0);
  if (!total) return <figure className="rounded-2xl border border-slate-200 bg-white p-5"><figcaption className="text-sm font-semibold text-slate-900">De onde vêm</figcaption><p className="mt-3 text-sm text-slate-400">Ainda sem dados.</p></figure>;

  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-5">
      <figcaption className="text-sm font-semibold text-slate-900">De onde vêm</figcaption>
      {/* Barra empilhada, com 2px de respiro entre os pedaços. */}
      <div className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {paises.slice(0, 4).map((p, i) => (
          <div
            key={p.country}
            style={{ width: `${(p.views / total) * 100}%`, backgroundColor: CORES[i % CORES.length] }}
            title={`${PAIS_NOME[p.country] ?? p.country}: ${fmt(p.views)}`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {paises.slice(0, 6).map((p, i) => (
          <li key={p.country} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: CORES[i % CORES.length] }}
              aria-hidden="true"
            />
            <span className="flex-1 text-slate-700">{PAIS_NOME[p.country] ?? p.country}</span>
            <span className="font-medium text-slate-900">{fmt(p.views)}</span>
            <span className="w-12 text-right text-xs text-slate-400">
              {Math.round((p.views / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Horários de pico
// ---------------------------------------------------------------------------
export function Horarios({ horas }: { horas: Resumo["horas"] }) {
  const porHora = Array.from({ length: 24 }, (_, h) => horas.find((x) => x.hour === h)?.views ?? 0);
  const max = Math.max(...porHora, 1);
  const temDados = porHora.some((v) => v > 0);

  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-5">
      <figcaption className="text-sm font-semibold text-slate-900">Horários de maior movimento</figcaption>
      {!temDados ? (
        <p className="mt-3 text-sm text-slate-400">Ainda sem dados.</p>
      ) : (
        <>
          <div className="mt-4 flex h-24 items-end gap-0.5">
            {porHora.map((v, h) => (
              <div key={h} className="group flex flex-1 flex-col justify-end" title={`${h}h — ${fmt(v)} visitas`}>
                <div
                  className="rounded-t-[3px]"
                  style={{
                    height: `${Math.max(2, (v / max) * 100)}%`,
                    backgroundColor: v === max ? CORES[1] : CORES[0],
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
          {/* "hora do Paraguai" escrito na tela de propósito: o dado é gravado
              em UTC e convertido na apresentação (ver analytics.ts). Sem dizer
              qual fuso é, o gráfico volta a ser ambíguo daqui a seis meses. */}
          <p className="mt-2 text-xs text-slate-400">
            Hora do Paraguai. Em laranja, o horário de pico — bom momento para o robô coletor pegar leve.
          </p>
        </>
      )}
    </figure>
  );
}

function SemDados({ texto }: { texto: string }) {
  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-400">{texto}</p>
    </figure>
  );
}
