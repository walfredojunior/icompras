"use client";

import { useCallback, useEffect, useState } from "react";
import { Cpu, MemoryStick, HardDrive, Activity, Network, RefreshCw } from "lucide-react";

// MONITOR VPS — processador, memória, disco, carga e rede.
//
// As amostras são de MINUTO EM MINUTO (pedido do dono): de 5 em 5 minutos um
// pico de um minuto simplesmente não apareceria, e é justamente o pico que se
// quer enxergar.

interface Agora {
  at: string | null;
  idadeSeg: number | null;
  cpu: number | null;
  mem: number | null;
  memUsadaMb: number | null;
  memTotalMb: number | null;
  swap: number | null;
  swapUsadaMb: number | null;
  swapTotalMb: number | null;
  disco: number | null;
  discoUsadoGb: number | null;
  discoTotalGb: number | null;
  carga1: number | null;
  carga5: number | null;
  carga15: number | null;
  rx: number | null;
  tx: number | null;
}
interface Ponto {
  quando: string;
  cpu: number | null;
  mem: number | null;
  carga: number | null;
  rx: number | null;
  tx: number | null;
}
interface Pico {
  hora: number;
  cpuMedia: number | null;
  cpuPico: number | null;
  cargaMedia: number | null;
  cargaPico: number | null;
  memMedia: number | null;
  amostras: number;
}
interface Dados {
  nucleos: number;
  agora: Agora | null;
  serie: Ponto[];
  picos: Pico[];
  visitasPorHora: Array<{ hora: number; visitas: number }>;
}

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(0)}%`);

/** Verde até 70, âmbar até 90, vermelho acima. */
function corDe(v: number | null, amarelo = 70, vermelho = 90) {
  if (v == null) return { txt: "text-slate-400", bg: "bg-slate-200" };
  if (v >= vermelho) return { txt: "text-red-600", bg: "bg-red-500" };
  if (v >= amarelo) return { txt: "text-amber-600", bg: "bg-amber-500" };
  return { txt: "text-brand-green-dark", bg: "bg-brand-green" };
}

function Medidor({
  icone,
  titulo,
  valor,
  detalhe,
  cor,
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
  cor: { txt: string; bg: string };
}) {
  const largura = Number(valor.replace("%", "")) || 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        {icone}
        {titulo}
      </div>
      <div className={`mt-2 text-3xl font-bold ${cor.txt}`}>{valor}</div>
      {valor.includes("%") && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${cor.bg}`} style={{ width: `${Math.min(100, largura)}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">{detalhe}</p>
    </div>
  );
}

/** Gráfico de linha em SVG — sem biblioteca, como o resto do projeto. */
function Linha({
  pontos,
  titulo,
  cor,
  sufixo,
  teto,
}: {
  pontos: Array<{ x: string; y: number | null }>;
  titulo: string;
  cor: string;
  sufixo: string;
  teto?: number;
}) {
  const vals = pontos.map((p) => p.y).filter((v): v is number => v != null);
  if (vals.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-700">{titulo}</div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Ainda sem amostras suficientes — o guardião coleta uma por minuto.
        </p>
      </div>
    );
  }
  const max = teto ?? Math.max(...vals, 1);
  const L = 100;
  const A = 34;
  const d = pontos
    .map((p, i) => {
      const x = (i / (pontos.length - 1)) * L;
      const y = A - ((p.y ?? 0) / max) * A;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const ultimo = vals[vals.length - 1];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{titulo}</span>
        <span className="text-sm font-semibold" style={{ color: cor }}>
          {ultimo.toLocaleString("pt-BR")}
          {sufixo}
        </span>
      </div>
      <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" className="mt-2 h-20 w-full">
        <path d={`${d} L${L},${A} L0,${A} Z`} fill={cor} opacity="0.12" />
        <path d={d} fill="none" stroke={cor} strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{pontos[0]?.x.slice(-5)}</span>
        <span>máx {max.toLocaleString("pt-BR")}{sufixo}</span>
        <span>{pontos[pontos.length - 1]?.x.slice(-5)}</span>
      </div>
    </div>
  );
}

export function MonitorVps() {
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [horas, setHoras] = useState(24);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/vps?horas=${horas}`);
      if (!r.ok) throw new Error("falha ao ler");
      setD(await r.json());
      setErro(null);
    } catch {
      setErro("não consegui ler as medidas");
    }
  }, [horas]);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 30_000);
    return () => clearInterval(t);
  }, [carregar]);

  if (erro) return <p className="text-sm text-red-600">{erro}</p>;
  if (!d) return <p className="text-sm text-slate-400">carregando…</p>;

  const a = d.agora;
  // A carga só faz sentido comparada ao número de núcleos: 6,4 é tranquilo em
  // 16 núcleos e é fila de três voltas em 2. Por isso o medidor mostra o
  // percentual em relação à capacidade da máquina.
  const cargaPct = a?.carga1 != null ? (a.carga1 / d.nucleos) * 100 : null;
  const maxVisitas = Math.max(1, ...d.visitasPorHora.map((v) => v.visitas));
  const maxPico = Math.max(1, ...d.picos.map((p) => p.cpuPico ?? 0));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Amostra de minuto em minuto · última há {a?.idadeSeg == null ? "—" : `${a.idadeSeg}s`}
          {a?.idadeSeg != null && a.idadeSeg > 300 && (
            <span className="ml-2 font-medium text-amber-700">
              (parada — o guardião pode estar fora do ar)
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {[6, 24, 72].map((h) => (
            <button
              key={h}
              onClick={() => setHoras(h)}
              className={`rounded-lg border px-2 py-1 text-xs ${
                horas === h
                  ? "border-brand-green bg-brand-green-light/40 font-medium text-brand-green-dark"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {h}h
            </button>
          ))}
          <button
            onClick={() => void carregar()}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-brand-green hover:text-brand-green-dark"
            title="Atualizar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Medidor
          icone={<Cpu className="h-4 w-4" />}
          titulo="Processador"
          valor={pct(a?.cpu ?? null)}
          detalhe={`${d.nucleos} núcleo(s)`}
          cor={corDe(a?.cpu ?? null)}
        />
        <Medidor
          icone={<MemoryStick className="h-4 w-4" />}
          titulo="Memória"
          valor={pct(a?.mem ?? null)}
          detalhe={
            a?.memUsadaMb != null
              ? `${(a.memUsadaMb / 1024).toFixed(1)} de ${((a.memTotalMb ?? 0) / 1024).toFixed(1)} GB` +
                (a.swapTotalMb
                  ? ` · reserva: ${a.swap === 0 ? "sem uso ✓" : `${a.swap}% em uso ⚠`}`
                  : " · SEM reserva de emergência")
              : "—"
          }
          cor={corDe(a?.mem ?? null, 80, 92)}
        />
        <Medidor
          icone={<HardDrive className="h-4 w-4" />}
          titulo="Disco"
          valor={pct(a?.disco ?? null)}
          detalhe={
            a?.discoUsadoGb != null ? `${a.discoUsadoGb} de ${a.discoTotalGb} GB` : "—"
          }
          cor={corDe(a?.disco ?? null, 75, 85)}
        />
        <Medidor
          icone={<Activity className="h-4 w-4" />}
          titulo="Carga"
          valor={a?.carga1 != null ? a.carga1.toFixed(2) : "—"}
          detalhe={`${cargaPct == null ? "—" : `${cargaPct.toFixed(0)}% da capacidade`} · 5min ${
            a?.carga5?.toFixed(2) ?? "—"
          } · 15min ${a?.carga15?.toFixed(2) ?? "—"}`}
          cor={corDe(cargaPct, 100, 200)}
        />
        <Medidor
          icone={<Network className="h-4 w-4" />}
          titulo="Rede"
          valor={a?.rx != null ? `${a.rx} kB/s` : "—"}
          detalhe={`entrada ${a?.rx ?? "—"} · saída ${a?.tx ?? "—"} kB/s`}
          cor={{ txt: "text-brand-navy", bg: "bg-brand-navy" }}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Linha
          titulo={`Processador — ${horas}h`}
          sufixo="%"
          cor="#2563eb"
          teto={100}
          pontos={d.serie.map((p) => ({ x: p.quando, y: p.cpu }))}
        />
        <Linha
          titulo={`Memória — ${horas}h`}
          sufixo="%"
          cor="#7c3aed"
          teto={100}
          pontos={d.serie.map((p) => ({ x: p.quando, y: p.mem }))}
        />
        <Linha
          titulo={`Carga — ${horas}h`}
          sufixo=""
          cor="#f97316"
          pontos={d.serie.map((p) => ({ x: p.quando, y: p.carga }))}
        />
      </div>

      {/* HORÁRIOS DE PICO — o que ele pediu. Mostra a média E o máximo: sem o
          máximo, um aperto de 15 minutos some dentro da média da hora. E as
          visitas do site vão junto, porque pico de processador às 3 da manhã
          não diz nada sozinho. */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="text-sm font-medium text-slate-700">Horários de pico (últimos 7 dias)</div>
        <p className="mt-1 text-xs text-slate-500">
          Barra alta = processador apertado naquela hora. A linha azul é a visita ao site, para
          você ver se o aperto vem de gente ou dos robôs.
        </p>
        <div className="mt-4 flex items-end gap-[3px]" style={{ height: 120 }}>
          {Array.from({ length: 24 }).map((_, h) => {
            const p = d.picos.find((x) => x.hora === h);
            const v = d.visitasPorHora.find((x) => x.hora === h);
            const alturaPico = p?.cpuPico ? (p.cpuPico / maxPico) * 100 : 0;
            const alturaMedia = p?.cpuMedia ? (p.cpuMedia / maxPico) * 100 : 0;
            const alturaVisita = v ? (v.visitas / maxVisitas) * 100 : 0;
            return (
              <div key={h} className="group relative flex-1">
                <div className="relative flex h-[100px] items-end">
                  <div className="w-full rounded-t bg-slate-200" style={{ height: `${alturaPico}%` }} />
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-brand-navy/70"
                    style={{ height: `${alturaMedia}%` }}
                  />
                  <div
                    className="absolute bottom-0 w-full border-t-2 border-blue-500"
                    style={{ height: `${alturaVisita}%` }}
                  />
                </div>
                <div className="mt-1 text-center text-[9px] text-slate-400">{h}</div>
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
                  {h}h · pico {p?.cpuPico ?? "—"}% · média {p?.cpuMedia ?? "—"}% · carga máx{" "}
                  {p?.cargaPico ?? "—"} · {v?.visitas ?? 0} visitas
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded bg-slate-200" /> pico da hora
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded bg-brand-navy/70" /> média da hora
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 bg-blue-500" /> visitas ao site
          </span>
        </div>
      </div>
    </div>
  );
}
