import { getTranslations, setRequestLocale } from "next-intl/server";
import { Search, TrendingDown } from "lucide-react"; // + Bell, quando o cartão de alertas voltar
import { Link } from "@/i18n/navigation";
import { SearchBox } from "@/components/SearchBox";
import { CategoryNav } from "@/components/CategoryNav";
import { BannerCarousel } from "@/components/BannerCarousel";
import { getActiveBanners, getFeaturedProducts } from "@/lib/banners";
import { getCategoryBlocks } from "@/lib/blocks";
import { CategoryBlocks } from "@/components/CategoryBlocks";
import { registrarVisita } from "@/lib/analytics";
import { getRates } from "@/lib/rates";
import { MoneyStack } from "@/components/MoneyStack";
import { getQuedas } from "@/lib/quedas";
import type { Metadata } from "next";
import { paginaMeta, enderecoDe, jsonLd, SITE_URL } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return paginaMeta({
    locale,
    caminho: "/",
    titulo: t("homeTitle"),
    descricao: t("homeDesc"),
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const td = await getTranslations("drops");

  void registrarVisita('home', '/');
  const heroBanners = await getActiveBanners("home_hero");
  const featured = await getFeaturedProducts();
  const blocks = await getCategoryBlocks(locale);
  const rates = await getRates();
  // 6 maiores quedas da semana. Se não houver nenhuma, o bloco nem aparece.
  const quedas = await getQuedas(7, 6);

  // Blocos de destaque por tema (título fixo enquanto não vira tradução).
  const blocksTitle =
    locale === "es" ? "Lo más buscado en Paraguay" : locale === "en" ? "Most searched in Paraguay" : "Mais procurados no Paraguai";

  // Identidade do site para o Google. Duas coisas: quem é o iCompras (para o
  // nome e a logo aparecerem no painel lateral da busca) e que o site tem
  // busca própria — o que pode render uma caixa de pesquisa dentro do próprio
  // resultado do Google.
  const fichaDoSite = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "iCompras",
      url: SITE_URL,
      logo: `${SITE_URL}/logo-full.png`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "iCompras",
      url: enderecoDe(locale, "/"),
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${enderecoDe(locale, "/search")}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(fichaDoSite) }} />
      {/* Hero + busca */}
      <section className="bg-gradient-to-b from-brand-green-light via-white to-slate-50">
        {/* Só o espaço de cima fica aqui; o de baixo saiu para a faixa de
            grupos, senão sobraria um vão entre a busca e ela. */}
        <div className="mx-auto max-w-3xl px-4 pt-8 pb-5 text-center sm:pt-16 sm:pb-6">
          {/* Um degrau menor em cada tamanho de tela (era 2xl/4xl/5xl). No
              computador o título ocupava duas linhas e empurrava a busca para
              baixo; agora cabe em uma. */}
          <h1 className="text-xl font-bold tracking-tight text-brand-navy sm:text-3xl lg:text-4xl">
            {t("title")}
          </h1>
          {/* Subtítulo retirado a pedido do dono do site (2026-07-31). O texto
              continua na chave "subtitle" das traduções, sem uso — para voltar
              é só descomentar a linha abaixo.
          <p className="mt-2 text-sm text-slate-600 sm:mt-4 sm:text-lg">{t("subtitle")}</p>
          */}
          <div className="mt-5 sm:mt-8">
            <SearchBox />
          </div>
        </div>

        {/* A faixa de grupos sai da caixa estreita do título.
            O bloco acima é max-w-3xl de propósito, para a frase não ficar
            comprida demais de ler — mas os grupos herdavam esses 736px e
            quebravam em 3 linhas mesmo num monitor de 1600px. Aqui eles usam a
            largura da página, como o resto do site. */}
        {/* Espaço de baixo reduzido (era pb-8/pb-14) para o banner subir. */}
        <div className="mx-auto max-w-6xl px-4 pb-5 sm:pb-7">
          <CategoryNav locale={locale} />
        </div>
      </section>

      {/* Banners promocionais */}
      {heroBanners.length > 0 && (
        <div className="mt-4">
          <BannerCarousel banners={heroBanners} />
        </div>
      )}

      {/* Baixaram de preço — só aparece quando há queda de verdade.
          Fica ANTES dos blocos temáticos de propósito: é a única parte da home
          que muda todo dia, e é o motivo para alguém voltar amanhã. */}
      {quedas.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <TrendingDown className="h-5 w-5 text-brand-green-dark" />
              {td("homeTitle")}
            </h2>
            <Link href="/quedas" className="text-sm font-medium text-brand-green-dark hover:underline">
              {td("homeSeeAll")} →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {quedas.map((q) => (
              <Link
                key={q.slug}
                href={`/produto/${q.slug}`}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-brand-green hover:shadow-sm"
              >
                <span className="absolute left-2 top-2 z-10 rounded-full bg-brand-green px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                  −{q.quedaPct}%
                </span>
                <div className="flex h-32 items-center justify-center bg-white">
                  {q.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.image_url} alt={q.name} className="max-h-32 object-contain" />
                  ) : (
                    <span className="text-2xl font-bold text-slate-300">{(q.brand || q.name).slice(0, 1)}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <span className="line-clamp-2 text-sm font-medium text-slate-800">{q.name}</span>
                  <div className="mt-auto pt-2">
                    <div className="text-xs text-slate-400 line-through">US$ {q.antes.toFixed(2)}</div>
                    <MoneyStack usd={q.agora} rates={rates} locale={locale} size="sm" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Blocos de destaque por tema */}
      <CategoryBlocks blocks={blocks} title={blocksTitle} locale={locale} />

      {/* Produtos em destaque */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-lg font-semibold text-slate-900">{t("featuredTitle")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <Link
                key={p.id}
                href={`/produto/${p.slug}`}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-brand-green hover:shadow-sm"
              >
                {/* Branco: as fotos já têm fundo branco (ver ProductCard). */}
                <div className="flex h-36 items-center justify-center bg-white">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="max-h-36 object-contain" />
                  ) : (
                    <span className="text-3xl font-bold text-slate-300">{(p.brand || p.name).slice(0, 1)}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <span className="line-clamp-2 text-sm font-medium text-slate-800">{p.name}</span>
                  <div className="mt-auto pt-2">
                    <MoneyStack usd={p.min_price != null ? Number(p.min_price) : null} rates={rates} locale={locale} size="sm" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Diferenciais */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-6">
        {/* Duas colunas enquanto o cartão de alertas está desligado (era 3). */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Busca inteligente */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-green hover:shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-green-light text-brand-green-dark">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{t("featureTypoTitle")}</h3>
            <p className="mt-1 text-sm text-slate-600">{t("featureTypoText")}</p>
          </div>

          {/* ALERTAS DE PREÇO DESLIGADO (2026-07-31) — mesma razão do login.
              Este cartão prometia "avisamos assim que o preço cair", e esse
              aviso nunca chegou a existir: o coletor troca 76 mil preços por
              dia sem avisar ninguém e sem registrar a mudança. Prometer na
              home o que o site não faz é pior do que não prometer nada.
              Para religar: descomentar, voltar a grade para sm:grid-cols-3
              acima, e reativar o import do ícone Bell.

          <div className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-green hover:shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-navy/10 text-brand-navy">
              <Bell className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{t("featureAlertTitle")}</h3>
            <p className="mt-1 text-sm text-slate-600">{t("featureAlertText")}</p>
          </div>
          */}

          {/* Organizado por IA — PYIA */}
          <div className="rounded-2xl border border-brand-green/40 bg-white p-6 shadow-sm ring-1 ring-brand-green/10 transition hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-white">
                {/* Logo animada: a mesma de sempre, vetorizada a partir do
                    pyia.png de 1254px e com os hexágonos soltos flutuando.
                    A animação está escrita dentro do próprio .svg — por isso
                    entra como imagem, sem script e sem risco de o estilo dela
                    vazar para o resto da página.

                    É a versão SÓ COM O SÍMBOLO. O "PYIA" escrito da logo
                    completa vira um borrão nos 44px desta caixa, e o selo
                    verde ao lado já diz o nome; sem ele o desenho ocupa todo
                    o espaço e o movimento aparece.

                    Para trocar, é só mudar esta linha:
                      /pyia-animado.svg           → símbolo animado (atual)
                      /pyia-animado-com-nome.svg  → logo inteira, animada
                      /pyia.png                   → como era antes, parada  */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/pyia-animado.svg" alt="PYIA" className="h-11 w-11 object-contain" />
              </div>
              <span className="rounded-full bg-brand-green-light px-2.5 py-1 text-xs font-bold tracking-wide text-brand-green-dark">
                PYIA
              </span>
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{t("featureAiTitle")}</h3>
            {/* O "Com tecnologia PYIA" que ficava aqui embaixo saiu: o texto
                novo já começa nomeando a PYIA, e com o selo do topo o nome
                apareceria três vezes no mesmo cartão. */}
            <p className="mt-1 text-sm text-slate-600">{t("featureAiText")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
