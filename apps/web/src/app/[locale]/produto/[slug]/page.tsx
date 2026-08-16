import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { paginaMeta, enderecoDe, cortar, precoUsd, jsonLd } from "@/lib/seo";
import { BackButton } from "@/components/BackButton";
import { getProductDetail, getRelatedProducts, getPriceHistory, getProductBreadcrumb } from "@/lib/products";
import { getCurrentUser } from "@/lib/auth";
import { registrarVisita } from "@/lib/analytics";
import { getRates } from "@/lib/rates";
import { MoneyStack } from "@/components/MoneyStack";
import { ProductOffers } from "@/components/ProductOffers";
import { BotaoAdicionar } from "@/components/BotaoDaLista";
import { ProductTabs } from "@/components/ProductTabs";
import { RelatedProducts } from "@/components/RelatedProducts";
import { Suspense } from "react";
import { EsqueletoRelacionados } from "@/components/Esqueleto";
// import { PriceAlertForm } from "@/components/PriceAlertForm";  // volta com o alerta
import { FavoriteButton } from "@/components/FavoriteButton";
import { isFavorite } from "@/lib/favorites";

/** Os preços reais desta página (loja sem oferta não tem preço). */
function precosDe(lojas: Array<{ priceUsd: number | null }>) {
  return lojas
    .map((l) => l.priceUsd)
    .filter((p): p is number => typeof p === "number" && p > 0)
    .sort((a, b) => a - b);
}

// TÍTULO E DESCRIÇÃO DE CADA PRODUTO.
//
// Isto é o que decide se as 224 mil páginas entram ou não no Google. Até
// 08/08/2026 todas se apresentavam como "iCompras — Comparador de precios",
// palavra por palavra — e página repetida o buscador não indexa.
//
// `getProductDetail` é chamado aqui E na página. Não é consulta dobrada: está
// dentro de `unstable_cache` (ver lib/products.ts), então a segunda chamada
// pega o resultado guardado.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProductDetail(slug);
  const t = await getTranslations({ locale, namespace: "seo" });

  // ⚠ O 404 PRECISA SER DECIDIDO AQUI, NÃO SÓ NA PÁGINA.
  //
  // Descoberto em 11/08/2026, testando a análise de produto: eu tinha posto a
  // checagem só no corpo da página, e o endereço continuava respondendo **200
  // com o nome do produto no título**.
  //
  // O motivo é a ordem: o `generateMetadata` roda ANTES e o Next já começa a
  // enviar o `<head>`. Quando a página finalmente chama `notFound()`, o
  // cabeçalho da resposta já saiu com 200 — o corpo vira "não encontrado", mas
  // o status mente e o nome do produto já vazou no título.
  //
  // Decidindo aqui, o 404 sai de verdade e nada do produto é enviado.
  if (!product || !product.ofertasNoAr) notFound();

  const precos = precosDe(product.stores);
  const preco = precoUsd(product.minUsd ?? (precos.length ? precos[0] : null));

  // O nome vem na frente porque é o que a pessoa digita na busca. O sufixo
  // "— preço no Paraguai" só entra quando sobra espaço: título cortado ao meio
  // pelo Google não ajuda ninguém.
  const nome = cortar(product.name, 60);
  const titulo = product.name.length <= 42 ? t("productTitle", { name: nome }) : nome;

  const descricao =
    preco && precos.length
      ? t("productDesc", { name: cortar(product.name, 55), n: precos.length, price: preco })
      : t("productDescSemOferta", { name: cortar(product.name, 70) });

  return paginaMeta({
    locale,
    caminho: `/produto/${slug}`,
    titulo,
    descricao,
    imagem: product.image_url,
  });
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("product");
  const tl = await getTranslations("listas");
  // const ta = await getTranslations("alerts");  // volta com o alerta
  const th = await getTranslations("home");

  const product = await getProductDetail(slug);
  if (!product) notFound();

  // PRODUTO SEM NENHUMA OFERTA NO AR NÃO TEM PÁGINA.
  //
  // Descoberto testando a análise de produto em 11/08/2026: um produto que a
  // loja ainda NÃO liberou continuava com página pública. Não mostrava preço
  // nem loja — mas mostrava o NOME, inclusive no título. Ou seja, o catálogo
  // do cliente vazava antes de ele decidir publicar, que é exatamente o que o
  // módulo existe para impedir.
  //
  // O mesmo vale para os 3.028 produtos que o coletor criou e que ficaram sem
  // oferta nenhuma: página sem preço e sem loja não serve para o visitante, e
  // ainda dilui o catálogo justamente agora que o Google começou a indexar.
  //
  // ⚠ O mapa do site também passou a excluí-los (produto/sitemap.ts) — do
  // contrário mandaríamos o Google a 3 mil endereços que respondem 404.
  //
  // ⚠ E a conta é `ofertasNoAr`, NÃO `stores.length`. A lista de lojas soma a
  // tabela do agregador, que não filtra `in_stock` — a primeira versão disto
  // usava `stores.length` e não escondeu nada. Ver o comentário do campo em
  // lib/products.ts.
  if (!product.ofertasNoAr) notFound();

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

  // FICHA DO PRODUTO PARA O GOOGLE (JSON-LD).
  //
  // O título e a descrição dizem ao buscador do que a página trata; isto aqui
  // entrega os DADOS: marca, foto, menor e maior preço e em quantas lojas. É o
  // que permite o resultado aparecer com preço e estrela em vez de duas linhas
  // de texto — e num comparador de preços é justamente esse o diferencial.
  const precos = precosDe(product.stores);
  const ficha = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: enderecoDe(locale, `/produto/${slug}`),
    ...(product.image_url ? { image: [product.image_url] } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    // Sem preço real não se declara oferta: anunciar oferta vazia é motivo de
    // penalidade nos dados estruturados do Google.
    ...(precos.length
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: precos[0],
            highPrice: precos[precos.length - 1],
            offerCount: precos.length,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };

  // A mesma trilha que aparece no topo da página, só que legível pelo Google —
  // é o que faz o resultado mostrar "iCompras › Celulares › iPhone" no lugar do
  // endereço cru.
  const trilha = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: homeLabel, item: enderecoDe(locale, "/") },
      ...crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: c.name,
        item: enderecoDe(locale, `/categorias/${c.slug}`),
      })),
      { "@type": "ListItem", position: crumbs.length + 2, name: product.name },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ficha) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(trilha) }} />
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

          {/* ADICIONAR À LISTA — sem cadastro, guarda no próprio navegador.
              Fica ANTES do botão de favorito de propósito: favoritar exige
              conta (e a conta está desligada da vitrine), enquanto a lista
              funciona no primeiro clique de qualquer visitante. */}
          <div className="mt-4">
            <BotaoAdicionar
              produto={{
                id: product.id,
                slug: product.slug,
                nome: product.name,
                imagem: product.image_url ?? null,
              }}
              rotuloAdd={tl("adicionar")}
              rotuloNaLista={tl("naLista")}
              textosMenu={{
                emQualLista: tl("emQualLista"),
                novaLista: tl("novaLista"),
                novaPadrao: tl("novaPadrao"),
                criar: tl("criar"),
                fechar: tl("fechar"),
              }}
            />
          </div>

          {/* ⚠ O BOTÃO ANTIGO DE FAVORITO SAIU DAQUI (15/08/2026).
              Ele exigia cadastro: quem clicava sem conta era mandado para
              /entrar. Com o botão novo logo acima, a página ficou com DOIS
              corações — um que funciona no primeiro clique e outro que pede
              cadastro. O dono percebeu na demonstração: "quando eu vou dar
              favorito sou obrigado a me cadastrar, a ideia era diferente".
              Ele estava certo, e o erro foi meu: acrescentei o novo sem tirar
              o velho. O componente continua existindo para /favoritos-conta.
          <FavoriteButton productId={product.id} inicial={favorito} logado={isLoggedIn} ... />
          */}

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
