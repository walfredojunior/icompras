"use client";

import { Radar, Flame, Sparkles } from "lucide-react";

// OS TRÊS PAINÉIS — um por função do coletor (pedido do dono, 05/08/2026).
//
// A regra que guiou o desenho: cada painel mostra um número que responde
// **"está funcionando?"**, e não apenas "está ligado?". Robô especializado que
// trava sem avisar é o pior caso — os preços que mais importam envelhecem em
// silêncio —, e um painel que só diz "online" não pegaria isso.

export interface RobosInfo {
  lista: Array<{
    id: number;
    papel: string;
    message: string | null;
    ciclos: number;
    itensNoCiclo: number;
    semSinalSeg: number | null;
    desdeVoltaMin: number | null;
  }>;
  normal: { categorias: number; recentes: number; maisAntigaH: number | null };
  quentes: { naLista: number; maisVelhoMin: number | null; faixas: Array<{ faixa: string; n: number }> };
  novos: { hoje: number; semana: number };
}

const tempo = (min: number | null) => {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)} dias`;
};

/** Verde = trabalhando · âmbar = demorando · vermelho = travado. */
function Selo({ ok, alerta, texto }: { ok: boolean; alerta: boolean; texto: string }) {
  const cor = ok
    ? "bg-brand-green-light text-brand-green-dark"
    : alerta
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-700";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cor}`}>{texto}</span>;
}

function Cartao({
  icone,
  titulo,
  selo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  selo: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icone}
          {titulo}
        </div>
        {selo}
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-slate-600">{children}</div>
    </div>
  );
}

const Linha = ({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-slate-500">{rotulo}</span>
    <span className="font-semibold text-slate-800">{valor}</span>
  </div>
);

export function PainelDosRobos({ r }: { r: RobosInfo | null }) {
  if (!r || !r.lista.length) return null;

  const porPapel = (p: string) => r.lista.filter((x) => x.papel === p);
  const travado = (p: string) =>
    porPapel(p).some((x) => x.semSinalSeg == null || x.semSinalSeg > 300);

  const quentes = r.quentes;
  // O número que importa nos quentes não é quantos existem, e sim há quanto
  // tempo o mais esquecido não é conferido. Passou de 2h, algo travou.
  const idadeQuentes = quentes.maisVelhoMin;
  const quentesOk = idadeQuentes != null && idadeQuentes <= 120;

  const roboNovos = porPapel("novos")[0];
  const novosOk = roboNovos ? (roboNovos.desdeVoltaMin ?? 999) <= 240 : false;

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <Cartao
        icone={<Radar className="h-4 w-4 text-brand-navy" />}
        titulo="Volta normal"
        selo={
          <Selo
            ok={!travado("normal")}
            alerta={false}
            texto={travado("normal") ? "travado" : `${porPapel("normal").length} robô(s)`}
          />
        }
      >
        <Linha rotulo="Categorias" valor={r.normal.categorias.toLocaleString("pt-BR")} />
        <Linha rotulo="Revisitadas em 2 dias" valor={r.normal.recentes.toLocaleString("pt-BR")} />
        <Linha rotulo="A mais esquecida" valor={tempo(r.normal.maisAntigaH == null ? null : r.normal.maisAntigaH * 60)} />
        {porPapel("normal")[0]?.message && (
          <p className="truncate pt-1 text-[11px] text-slate-400">{porPapel("normal")[0].message}</p>
        )}
      </Cartao>

      <Cartao
        icone={<Flame className="h-4 w-4 text-orange-500" />}
        titulo="Produtos quentes"
        selo={
          quentes.naLista === 0 ? (
            <Selo ok={false} alerta texto="sem lista" />
          ) : (
            <Selo ok={quentesOk} alerta={!quentesOk} texto={quentesOk ? "em dia" : "atrasado"} />
          )
        }
      >
        <Linha rotulo="Na lista" valor={quentes.naLista.toLocaleString("pt-BR")} />
        <Linha rotulo="Preço mais velho" valor={tempo(idadeQuentes)} />
        {quentes.faixas.length > 0 && (
          <p className="pt-1 text-[11px] text-slate-400">
            {quentes.faixas
              .sort((a, b) => b.n - a.n)
              .map((f) => `${f.faixa}: ${f.n.toLocaleString("pt-BR")}`)
              .join(" · ")}
          </p>
        )}
        {quentes.naLista === 0 && (
          <p className="pt-1 text-[11px] text-amber-700">
            Nenhum produto classificado ainda — roda ao fim da primeira volta.
          </p>
        )}
      </Cartao>

      <Cartao
        icone={<Sparkles className="h-4 w-4 text-brand-green-dark" />}
        titulo="Produtos novos"
        selo={
          roboNovos ? (
            <Selo ok={novosOk} alerta={!novosOk} texto={novosOk ? "varrendo" : "atrasado"} />
          ) : (
            <Selo ok={false} alerta texto="sem robô" />
          )
        }
      >
        <Linha rotulo="Entraram hoje" valor={r.novos.hoje.toLocaleString("pt-BR")} />
        <Linha rotulo="Na semana" valor={r.novos.semana.toLocaleString("pt-BR")} />
        <Linha rotulo="Última varredura" valor={tempo(roboNovos?.desdeVoltaMin ?? null)} />
        {roboNovos?.message && (
          <p className="truncate pt-1 text-[11px] text-slate-400">{roboNovos.message}</p>
        )}
      </Cartao>
    </div>
  );
}
