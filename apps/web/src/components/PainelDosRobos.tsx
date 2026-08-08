"use client";

import { Radar, Flame, Sparkles, Route, PackageX } from "lucide-react";

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
  /** Por onde o coletor está saindo. Null se o banco ainda não tem a tabela. */
  saida?: {
    modo: string;
    trocas: number;
    bloqueios: number;
    ultimo403Min: number | null;
    desdeMin: number | null;
    detalhe: string | null;
    ipAtual: string | null;
    trocasIp: number;
    ultimaTrocaIpMin: number | null;
    ipVistoMin: number | null;
  } | null;
  /** Ofertas que saíram do ar. Null se o banco ainda não tem as colunas. */
  baixas?: {
    foraDoAr: number;
    hoje: number;
    semana: number;
    voltaramHoje: number;
    voltaramSemana: number;
    porAusencia: number;
    porTempo: number;
    lojas: Array<{ nome: string; n: number }>;
    freio: { status: string; detalhe: string | null; haMin: number } | null;
  } | null;
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
  // O número que importa nos quentes não é quantos existem, e sim **há quanto
  // tempo o mais esquecido da lista não é reconferido**.
  //
  // ⚠ O limite é 6 HORAS, e não as 2 que eu tinha posto no primeiro dia.
  // Aquele número foi escolhido ANTES de medir: eu estimava uma volta de ~1h,
  // mas o ritmo real é ~4h45 (cada página precisa ser renderizada pelo
  // navegador, ~8s por produto, e não os 2s da pausa de educação). Com 2h o
  // painel acusava "atrasado" o tempo todo, mesmo funcionando perfeitamente —
  // e alarme que sempre toca é alarme que ninguém olha.
  //
  // 6h é a promessa da própria faixa "quente" (FAIXAS.quente em
  // apps/worker/src/prioridade.ts). Assim o âmbar significa exatamente uma
  // coisa: o robô deixou de cumprir o que prometeu.
  const LIMITE_QUENTES_MIN = 360;
  const idadeQuentes = quentes.maisVelhoMin;
  const quentesOk = idadeQuentes != null && idadeQuentes <= LIMITE_QUENTES_MIN;

  const roboNovos = porPapel("novos")[0];
  // Volta de descoberta = mapa do site (~6 min) + pausa de 30 min ≈ 40 min.
  // (As 1.888 páginas de marca saíram daqui: rodam uma vez por dia — antes
  // faziam a volta passar de uma hora e o robô nunca fechar ciclo, o que
  // deixava este cartão em "atrasado" para sempre.)
  //
  // Enquanto a PRIMEIRA volta não fecha, não há o que julgar: mostra
  // "primeira volta" em vez de acusar atraso que não existe.
  const LIMITE_NOVOS_MIN = 90;
  const novosNuncaFechou = !roboNovos || roboNovos.desdeVoltaMin == null;
  const novosOk = !novosNuncaFechou && (roboNovos!.desdeVoltaMin ?? 0) <= LIMITE_NOVOS_MIN;

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

      {/* POR ONDE O COLETOR SAI — pedido dele em 07/08/2026: "quero no
          monitor quantas vezes trocou de ip pra eu saber".

          Só aparece se houver algo a contar. Cartão que mostra "0 trocas"
          para sempre vira ruído, e o painel já tem informação demais. */}
      {r.saida && (r.saida.modo !== "direto" || r.saida.bloqueios > 0) && (
        <Cartao
          icone={<Route className="h-4 w-4 text-brand-navy" />}
          titulo="Saída do coletor"
          selo={
            <Selo
              ok={r.saida.modo === "direto"}
              alerta={r.saida.modo !== "direto"}
              texto={r.saida.modo === "direto" ? "direto" : "pelo proxy"}
            />
          }
        >
          {/* O IP DE AGORA vem primeiro: é a pergunta que ele faz ao abrir a
              tela ("estou saindo por onde?"). Fonte fixa para não dançar a
              cada troca. */}
          <Linha
            rotulo="IP de saída agora"
            valor={
              <span className="font-mono text-[12px]">
                {r.saida.ipAtual ?? "—"}
              </span>
            }
          />
          <Linha rotulo="Trocas de IP" valor={r.saida.trocasIp.toLocaleString("pt-BR")} />
          <Linha
            rotulo="Última troca de IP"
            valor={r.saida.ultimaTrocaIpMin == null ? "nenhuma ainda" : tempo(r.saida.ultimaTrocaIpMin)}
          />
          {/* Trocar de CAMINHO é outra coisa, e mais grave: significa que
              Dallas caiu e a coleta voltou a sair pelo IP da VPS. Ficava com o
              rótulo "Trocas de IP" até 08/08/2026, o que explicava o painel
              mostrar 0 enquanto Dallas trocava de IP sete vezes no mesmo dia. */}
          <Linha rotulo="Trocas de caminho" valor={r.saida.trocas.toLocaleString("pt-BR")} />
          <Linha rotulo="Bloqueios (403)" valor={r.saida.bloqueios.toLocaleString("pt-BR")} />
          <Linha
            rotulo="Último bloqueio"
            valor={r.saida.ultimo403Min == null ? "nunca" : tempo(r.saida.ultimo403Min)}
          />
          {/* Medida velha = o guardião não está conseguindo perguntar pelo
              proxy. O número acima continua na tela, e sem este aviso pareceria
              atual. Ele mede de 5 em 5 min; 20 já é atraso de verdade. */}
          {r.saida.ipVistoMin != null && r.saida.ipVistoMin > 20 && (
            <p className="pt-1 text-[11px] text-amber-600">
              ⚠ medida de {tempo(r.saida.ipVistoMin)} atrás — o proxy pode estar fora do ar
            </p>
          )}
          {r.saida.detalhe && (
            <p className="truncate pt-1 text-[11px] text-slate-400">{r.saida.detalhe}</p>
          )}
        </Cartao>
      )}

      {/* OFERTAS QUE SAÍRAM DO AR — pedido dele em 08/08/2026: "daí teríamos um
          monitor de produtos desativados".

          Não é enfeite: é o instrumento que prova que a regra está se
          comportando. Sem ele, a marcação acontece no escuro e não dá para
          saber se hoje saíram 12 ofertas ou 12 mil. */}
      {r.baixas && (
        <Cartao
          icone={<PackageX className="h-4 w-4 text-slate-500" />}
          titulo="Saíram do ar"
          selo={
            r.baixas.freio?.status === "teto-atingido" && r.baixas.freio.haMin < 1440 ? (
              <Selo ok={false} alerta texto="trava disparou" />
            ) : undefined
          }
        >
          <Linha rotulo="Hoje" valor={r.baixas.hoje.toLocaleString("pt-BR")} />
          <Linha rotulo="Na semana" valor={r.baixas.semana.toLocaleString("pt-BR")} />
          <Linha rotulo="Fora do ar no total" valor={r.baixas.foraDoAr.toLocaleString("pt-BR")} />
          {/* O NÚMERO MAIS IMPORTANTE DA TELA. Oferta que sai e volta é oferta
              boa derrubada por engano. Fica em verde quando é zero e em âmbar
              quando passa de 5% do que saiu — aí o prazo está curto. */}
          <Linha
            rotulo="Voltaram (semana)"
            valor={
              <span
                className={
                  r.baixas.voltaramSemana > Math.max(10, r.baixas.semana * 0.05)
                    ? "text-amber-600"
                    : "text-emerald-600"
                }
              >
                {r.baixas.voltaramSemana.toLocaleString("pt-BR")}
              </span>
            }
          />
          <Linha
            rotulo="Motivo"
            valor={
              <span className="text-[12px] font-normal text-slate-500">
                {r.baixas.porAusencia.toLocaleString("pt-BR")} sumiu da loja ·{" "}
                {r.baixas.porTempo.toLocaleString("pt-BR")} por tempo
              </span>
            }
          />
          {r.baixas.lojas.length > 0 && (
            <p className="truncate pt-1 text-[11px] text-slate-400">
              semana: {r.baixas.lojas.map((l) => `${l.nome} (${l.n})`).join(" · ")}
            </p>
          )}
          {r.baixas.freio && (
            <p
              className={`pt-1 text-[11px] ${
                r.baixas.freio.status === "teto-atingido" ? "text-amber-600" : "text-slate-400"
              }`}
            >
              {r.baixas.freio.status === "teto-atingido" ? "⛔ " : ""}
              {r.baixas.freio.detalhe} — {tempo(r.baixas.freio.haMin)}
            </p>
          )}
        </Cartao>
      )}

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
        <p className="pt-0.5 text-[11px] text-slate-400">
          Uma volta completa leva ~5h. Vira alerta se passar de 6h.
        </p>
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
          !roboNovos ? (
            <Selo ok={false} alerta texto="sem robô" />
          ) : novosNuncaFechou ? (
            <Selo ok alerta={false} texto="primeira volta" />
          ) : (
            <Selo ok={novosOk} alerta={!novosOk} texto={novosOk ? "varrendo" : "atrasado"} />
          )
        }
      >
        <Linha rotulo="Entraram hoje" valor={r.novos.hoje.toLocaleString("pt-BR")} />
        <Linha rotulo="Na semana" valor={r.novos.semana.toLocaleString("pt-BR")} />
        <Linha
          rotulo="Última varredura"
          valor={novosNuncaFechou ? "em andamento" : tempo(roboNovos.desdeVoltaMin)}
        />
        <p className="pt-0.5 text-[11px] text-slate-400">
          Procura de ~40 em 40 min. Vira alerta se passar de 1h30.
        </p>
        {roboNovos?.message && (
          <p className="truncate pt-1 text-[11px] text-slate-400">{roboNovos.message}</p>
        )}
      </Cartao>
    </div>
  );
}
