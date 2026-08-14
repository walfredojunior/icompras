import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { getResumo } from "@/lib/analytics";
import { Destaque, LinhaVisitas, Barras, Paises, Horarios } from "@/components/VisitCharts";
import { Link } from "@/i18n/navigation";

const PERIODOS = [7, 30, 90];

export default async function AdminVisitasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ dias?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const sp = await searchParams;
  const dias = PERIODOS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const r = await getResumo(dias);

  const variacao =
    r.totalAnterior > 0 ? Math.round(((r.totalPeriodo - r.totalAnterior) / r.totalAnterior) * 100) : null;
  const paginas = r.produtos.reduce((n, p) => n + p.views, 0) + r.categorias.reduce((n, c) => n + c.views, 0);
  const celular = r.dispositivos.find((d) => d.device === "mobile")?.views ?? 0;
  const totalDisp = r.dispositivos.reduce((n, d) => n + d.views, 0);

  // MÉDIA DIÁRIA — pedida por ele em 12/08/2026.
  //
  // Dois cuidados que mudam o número, e por isso não é só `total / dias`:
  //
  // 1) FORA O DIA DE HOJE. O dia corrente está pela metade — às 9h da manhã
  //    ele tem ~1/3 das visitas que terá. Incluí-lo derruba a média e faz o
  //    site parecer estar piorando toda manhã. Por isso o último dia da série
  //    sai da conta, e o rótulo diz isso em voz alta.
  //
  // 2) DIVIDE PELOS DIAS QUE EXISTEM, não pelos 30 do filtro. A consulta só
  //    devolve dias que tiveram visita; se o site tem 12 dias de histórico e o
  //    filtro pede 90, dividir por 90 daria uma média 7× menor que a real.
  //    Conta o intervalo do calendário (primeiro dia até ontem), assim um dia
  //    sem visita nenhuma entra como zero em vez de sumir da conta.
  // ⚠ Só tira o último se ele FOR hoje. Cortar às cegas (`slice(0,-1)`) dava
  // certo de dia e errado de madrugada: antes da primeira visita do dia, o
  // último item da série é ONTEM — um dia fechado, e o mais recente que existe.
  // Descartá-lo jogaria fora justamente o dado mais novo.
  //
  // Compara em UTC porque `analytics_daily.day` é gravado com a data do
  // servidor, que roda em UTC (o Paraguai é UTC−3 — ver a seção do fuso na
  // memória do projeto). Comparar com a data local daria um dia de diferença
  // durante as 3 primeiras horas da noite.
  const hojeNoServidor = new Date().toISOString().slice(0, 10);
  const serie =
    r.dias.length && r.dias[r.dias.length - 1].day === hojeNoServidor ? r.dias.slice(0, -1) : r.dias;
  const somaFechada = serie.reduce((n, d) => n + d.views, 0);
  const diasContados = serie.length
    ? Math.max(
        1,
        Math.round(
          (Date.parse(`${serie[serie.length - 1].day}T00:00:00Z`) - Date.parse(`${serie[0].day}T00:00:00Z`)) /
            86_400_000,
        ) + 1,
      )
    : 0;
  const mediaDiaria = diasContados ? Math.round(somaFechada / diasContados) : 0;

  return (
    <div
      className="space-y-6"
      style={
        {
          // Paleta categórica validada (contraste e daltonismo conferidos).
          "--serie-1": "#2a78d6",
          "--serie-2": "#eb6834",
          "--serie-3": "#1baf7a",
          "--serie-4": "#eda100",
          "--grade": "#e9e9e7",
          "--texto-fraco": "#8a8a85",
        } as React.CSSProperties
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Visitas</h1>
          <p className="text-sm text-slate-500">
            Contagens agregadas por dia. Não guardamos endereço de IP nem dado pessoal.
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <Link
              key={p}
              href={`/admin/visitas?dias=${p}`}
              className={`rounded-full px-3 py-1 text-xs transition ${
                dias === p
                  ? "bg-brand-navy font-medium text-white"
                  : "border border-slate-200 text-slate-600 hover:border-brand-green"
              }`}
            >
              {p} dias
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Destaque rotulo="Visitas no período" valor={r.totalPeriodo} variacao={variacao} />
        <Destaque
          rotulo="Média por dia"
          valor={mediaDiaria}
          sufixo={
            diasContados
              ? `em ${diasContados} ${diasContados === 1 ? "dia" : "dias"}, sem contar hoje`
              : "ainda sem dia fechado"
          }
        />
        <Destaque rotulo="Páginas de produto e categoria" valor={paginas} />
        <Destaque
          rotulo="Pelo celular"
          valor={celular}
          sufixo={totalDisp ? `de ${totalDisp.toLocaleString("pt-BR")}` : undefined}
        />
        <Destaque rotulo="Visitantes enviados às lojas" valor={r.totalCliques} />
      </div>

      <LinhaVisitas dias={r.dias} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Paises paises={r.paises} />
        <Horarios horas={r.horas} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Barras
          titulo="Produtos mais vistos"
          itens={r.produtos.map((p) => ({ rotulo: p.name, valor: p.views }))}
          cor={0}
        />
        <Barras
          titulo="Buscaram e não acharam nada"
          itens={r.semResultado.map((s) => ({ rotulo: s.term, valor: s.searches }))}
          cor={3}
          destaqueAviso
          vazio="Nenhuma busca sem resultado no período. Bom sinal."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Barras
          titulo="Visitantes enviados a cada loja"
          itens={r.lojas.map((l) => ({ rotulo: l.name, valor: l.clicks }))}
          cor={2}
          vazio="Ninguém clicou para uma loja ainda."
        />
        <Barras
          titulo="Categorias mais visitadas"
          itens={r.categorias.map((c) => ({ rotulo: c.name, valor: c.views }))}
          cor={0}
        />
      </div>

      <Barras
        titulo="O que mais buscaram"
        itens={r.buscas.map((b) => ({
          rotulo: b.term,
          valor: b.searches,
          extra: b.last_results ? `${b.last_results.toLocaleString("pt-BR")} resultados` : "sem resultado",
        }))}
        cor={0}
      />

      <p className="text-xs text-slate-400">
        Robôs de busca (Google, Bing e afins) não entram nesta contagem.
      </p>
    </div>
  );
}
