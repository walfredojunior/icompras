import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { BackButton } from "@/components/BackButton";
import { getProductDetail, getRelatedProducts, getPriceHistory, getProductBreadcrumb } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";
import { registrarVisita } from "@/lib/analytics";
import { getRates } from "@/lib/rates";
import { MoneyStack } from "@/components/MoneyStack";
import { ProductOffers } from "@/components/ProductOffers";
import { ProductTabs } from "@/components/ProductTabs";
import { RelatedProducts } from "@/components/RelatedProducts";
import { Suspense } from "react";
import { EsqueletoRelacionados } from "@/components/Esqueleto";
// import { PriceAlertForm } from "@/components/PriceAlertForm";  // volta com o alerta
import { FavoriteButton } from "@/components/FavoriteButton";
import { isFavorite } from "@/lib/favorites";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("product");
  // const ta = await getTranslations("alerts");  // volta com o alerta
  const th = await getTranslations("home");

  const product = await getProductDetail(slug);
  if (!product) notFound();

  void registrarVisita("produto", slug);
  const rates = await getRates();
  const usuario = await getCurrentUser();
  const isLoggedIn = !!usuario;
  // `getRelatedProducts` NÃO é esperado aqui de propósito — ver o componente
  // Relacionados no fim do arquivo.
  const history = await getPriceHistory(product.id, rates);
  const crumbs = await getProductBreadcrumb(slug, locale);
  const favorito = usuario ? await isFavorite(usuario.id, product.id) : false;
  const homeLabel = locale === "es" ? "Inicio" : locale === "en" ? "Home" : "Início";

  const derivedSpecs = [
    product.brand ? { k: t("brand"), v: product.brand } : null,
    product.colors.length ? { k: t("colors"), v: product.colors.join(", ") } : null,
    { k: t("storesCount"), v: String(product.stores.length) },
  ].filter(Boolean) as Array<{ k: string; v: string }>;
  const specs = product.specs.length ? product.specs : derivedSpecs;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-400">
        <Link href="/" className="hover:text-brand-navy">
          {homeLabel}
        </Link>
        {crumbs.map((c) => (
          <span key={c.slug} className="flex items-center gap-1">
            <span>›</span>
            <Link href={`/categorias/${c.slug}`} className="hover:text-brand-navy">
              {c.name}
            </Link>
          </span>
        ))}
        <span>›</span>
        <span className="text-slate-500">{product.name}</span>
      </nav>
      <BackButton label={t("back")} fallbackHref={`/${locale}`} />

      <div className="mt-4 flex flex-col gap-8 sm:flex-row">
        <div className="flex h-64 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white sm:w-64">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="max-h-60 object-contain" />
          ) : (
            <span className="text-6xl font-bold text-slate-300">
              {(product.brand || product.name).slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex-1">
          {product.brand ? (
            <span className="text-xs uppercase tracking-wide text-slate-400">{product.brand}</span>
          ) : null}
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          <div className="mt-3">
            <span className="text-sm text-slate-400">{t("from")}</span>
            <MoneyStack usd={product.minUsd} rates={rates} locale={locale} size="lg" />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {product.stores.length} {t("storesCount").toLowerCase()}
          </p>

          <div className="mt-4">
            <FavoriteButton
              productId={product.id}
              inicial={favorito}
              logado={isLoggedIn}
              labels={{
                favorite: t("favorite"),
                favorited: t("favorited"),
                loginToFavorite: t("loginToFavorite"),
              }}
            />
          </div>

          {/* ALERTA DE PREÇO DESLIGADO (2026-07-31) — mesma razão do login.
              O aviso de queda de preço nunca funcionou: quem dispara alerta
              só roda quando uma LOJA envia lista de preços pela API, e quem
              atualiza os preços de verdade é o coletor, que não passa por lá.
              Ficava aqui um botão "Entre para criar um alerta de preço" que
              levava a pessoa a criar conta por um aviso que jamais chegaria.
              Para religar: descomentar (e antes ligar o coletor no alerta).

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <PriceAlertForm
              productId={product.id}
              isLoggedIn={isLoggedIn}
              loginHref={`/${locale}/entrar`}
              dict={{
                cta: ta("cta"),
                placeholder: ta("placeholder"),
                submit: ta("submit"),
                created: ta("created"),
                loginToAlert: ta("loginToAlert"),
              }}
            />
          </div>
          */}
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">{t("storesThatSell")}</h2>
      {product.stores.length === 0 ? (
        <p className="text-slate-500">{t("noOffers")}</p>
      ) : (
        <ProductOffers
          productName={product.name}
          productImage={product.image_url}
          stores={product.stores}
          rates={rates}
          locale={locale}
          dict={{
            relevance: t("sortRelevance"),
            priceAsc: t("sortPriceAsc"),
            priceDesc: t("sortPriceDesc"),
            productAz: t("sortProductAz"),
            productZa: t("sortProductZa"),
            store: t("sortStore"),
            newest: t("sortNewest"),
            cheapest: t("cheapest"),
            seeStore: t("seeStore"),
            code: t("code"),
            sortBy: t("sortBy"),
            detalhe: {
              code: t("code"),
              seeInStore: t("seeInStore"),
              seeStore: t("seeStore"),
              whatsapp: "WhatsApp",
              close: t("closePanel"),
              specs: t("specsShort"),
              soldBy: t("soldBy"),
              noLink: t("noProductLink"),
            },
          }}
          specs={product.specs}
        />
      )}

      <ProductTabs
        specs={specs}
        history={history}
        locale={locale}
        labels={{
          specifications: t("specifications"),
          priceHistory: t("priceHistory"),
          noHistory: t("noHistory"),
          lowestPrice: t("lowestPrice"),
        }}
      />

      {/* Os relacionados chegam DEPOIS, sem segurar o resto da página.
          Medido em 05/08/2026: essa busca por semelhança compara o produto com
          134 mil outros e leva ~2,5s — era ela que fazia a página inteira
          demorar 2,2s para aparecer. Agora o visitante vê produto, preço e
          lojas quase instantaneamente, e esta faixa preenche sozinha. */}
      <Suspense fallback={<EsqueletoRelacionados titulo={t("related")} />}>
        <Relacionados
          productId={product.id}
          locale={locale}
          rates={rates}
          title={t("related")}
          fromLabel={th("from")}
          storesLabel={th("stores")}
        />
      </Suspense>
    </div>
  );
}

async function Relacionados({
  productId,
  locale,
  rates,
  title,
  fromLabel,
  storesLabel,
}: {
  productId: number;
  locale: string;
  rates: Awaited<ReturnType<typeof getRates>>;
  title: string;
  fromLabel: string;
  storesLabel: string;
}) {
  const items = await getRelatedProducts(productId);
  return (
    <RelatedProducts
      items={items}
      locale={locale}
      rates={rates}
      title={title}
      fromLabel={fromLabel}
      storesLabel={storesLabel}
    />
  );
}
