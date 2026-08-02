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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Destaque rotulo="Visitas no período" valor={r.totalPeriodo} variacao={variacao} />
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
