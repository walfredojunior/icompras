import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getQuedas, contarQuedas, JANELAS, ORDENS, ORDEM_PADRAO, type Janela, type Ordem } from "@/lib/quedas";
import { getRates } from "@/lib/rates";
import { paginaMeta } from "@/lib/seo";
import { registrarVisita } from "@/lib/analytics";
import { MoneyStack } from "@/components/MoneyStack";
import { TrendingDown } from "lucide-react";

// Página de produtos que baixaram de preço.
//
// É o substituto honesto do alerta de preço: não precisa de conta, não precisa
// de e-mail nem de notificação, e dá motivo para a pessoa voltar. Vive do
// resumo diário (product_price_daily), que o coletor atualiza a cada volta.
//
// Também é a página com mais chance de trazer gente do Google: é conteúdo que
// se renova sozinho todo dia.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "drops" });
  // O " — iCompras" saiu do título: agora o modelo do layout põe " | iCompras"
  // em todas as páginas, e escrito aqui apareceria duas vezes.
  //
  // O canônico aponta para /quedas sem nada atrás: os filtros de dias e de
  // ordem são a MESMA página reorganizada, e sem isto o Google indexaria as
  // dezoito combinações como páginas diferentes.
  return paginaMeta({
    locale,
    caminho: "/quedas",
    titulo: t("title"),
    descricao: t("subtitle"),
  });
}

function janelaDaUrl(v: string | undefined): Janela {
  const n = Number(v);
  return (JANELAS as readonly number[]).includes(n) ? (n as Janela) : 7;
}

// ⚠ Traduz o que veio na URL para uma chave conhecida, e nada mais.
// O texto do visitante NUNCA chega ao ORDER BY — o que vai para a consulta
// é sempre um dos valores fixos de ORDENS.
function ordemDaUrl(v: string | undefined): Ordem {
  return v && v in ORDENS ? (v as Ordem) : ORDEM_PADRAO;
}

export default async function QuedasPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ dias?: string; ordem?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const busca = await searchParams;
  const dias = janelaDaUrl(busca.dias);
  const ordem = ordemDaUrl(busca.ordem);

  const t = await getTranslations("drops");

  void registrarVisita("quedas", String(dias));
  const [itens, contagens, rates] = await Promise.all([
    getQuedas(dias, 60, undefined, ordem),
    contarQuedas(),
    getRates(),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-green-light text-brand-green-dark">
          <TrendingDown className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-brand-navy sm:text-3xl">{t("title")}</h1>
          <p className="text-sm text-slate-500">{t("subtitle")}</p>
        </div>
      </div>

      {/* Abas de período. Links de verdade (e não botões) para o Google
          conseguir seguir cada período como uma página própria. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {JANELAS.map((d) => {
          const ativa = d === dias;
          return (
            <Link
              key={d}
              href={`/quedas?dias=${d}`}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                ativa
                  ? "border-brand-green bg-brand-green-light font-semibold text-brand-green-dark"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-green"
              }`}
            >
              {t(`window${d}`)}
              <span className={`ml-1.5 text-xs ${ativa ? "text-brand-green-dark/70" : "text-slate-400"}`}>
                {contagens[d]}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ORDEM DA LISTA.

          Links e não um <select>: o período ao lado já é link, o Google
          consegue seguir, e funciona sem JavaScript. O período escolhido
          viaja junto para não se perder ao trocar a ordem. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">{t("sortBy")}:</span>
        {(Object.keys(ORDENS) as Ordem[]).map((o) => {
          const ativa = o === ordem;
          return (
            <Link
              key={o}
              href={`/quedas?dias=${dias}&ordem=${o}`}
              className={`rounded-full px-3 py-1.5 text-xs transition ${
                ativa
                  ? "bg-brand-navy font-semibold text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t(`sort_${o}`)}
            </Link>
          );
        })}
      </div>

      {itens.length === 0 ? (
        // O histórico começou a ser gravado agora; nos primeiros dias a lista
        // fica vazia porque ainda não existe "ontem" com que comparar.
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="font-medium text-slate-700">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("emptyText")}</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
          {itens.map((q) => (
            <Link
              key={q.slug}
              href={`/produto/${q.slug}`}
              className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-brand-green hover:shadow-md"
            >
              <span className="absolute left-2 top-2 z-10 rounded-full bg-brand-green px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                −{q.quedaPct}%
              </span>
              <div className="flex h-40 items-center justify-center bg-white">
                {q.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.image_url} alt={q.name} className="max-h-40 object-contain" />
                ) : (
                  <span className="text-3xl font-bold text-slate-300">
                    {(q.brand || q.name).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                {q.brand ? <span className="text-xs uppercase tracking-wide text-slate-400">{q.brand}</span> : null}
                <span className="mt-1 line-clamp-2 font-medium text-slate-900">{q.name}</span>
                <div className="mt-auto pt-3">
                  {/* O preço antigo riscado é o que faz a queda ser sentida. */}
                  <div className="text-xs text-slate-400 line-through">
                    {t("was")} US$ {q.antes.toFixed(2)}
                  </div>
                  <MoneyStack usd={q.agora} rates={rates} locale={locale} size="md" />
                  {/* Plural de verdade: "1 loja", não "1 lojas". */}
                  <div className="mt-1 text-xs text-slate-400">{t("storeCount", { n: q.lojas })}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-slate-400">{t("note")}</p>
    </div>
  );
}
