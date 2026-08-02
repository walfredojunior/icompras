import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getStore, getStoreProducts } from "@/lib/stores";
import { registrarVisita } from "@/lib/analytics";
import { getRates } from "@/lib/rates";
import { ProductCard } from "@/components/ProductCard";
import { BackButton } from "@/components/BackButton";
import { Link } from "@/i18n/navigation";

export default async function StorePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const store = await getStore(slug);
  if (!store) notFound();

  void registrarVisita('loja', slug);
  const rates = await getRates();
  const products = await getStoreProducts(store.id);
  const t = await getTranslations("store");
  const th = await getTranslations("home");
  const tp = await getTranslations("product");

  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(store.mapsQuery)}&output=embed`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-400">
        <Link href="/" className="hover:text-brand-navy">
          {locale === "es" ? "Inicio" : locale === "en" ? "Home" : "Início"}
        </Link>
        <span>›</span>
        <Link href="/lojas" className="hover:text-brand-navy">
          {locale === "es" ? "Tiendas" : locale === "en" ? "Stores" : "Lojas"}
        </Link>
        <span>›</span>
        <span className="text-slate-500">{store.name}</span>
      </nav>
      <div className="mb-4">
        <BackButton label={tp("back")} fallbackHref={`/${locale}`} />
      </div>
      <div className="flex items-center gap-4">
        {store.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.logo} alt={store.name} className="h-16 w-16 rounded-xl object-contain" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 text-2xl font-bold text-slate-500">
            {store.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{store.name}</h1>
          {store.city ? <p className="text-sm text-slate-500">{store.city}</p> : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
          <dl className="space-y-3">
            <div>
              <dt className="text-slate-400">{t("address")}</dt>
              <dd className="text-slate-800">{store.address || t("noAddress")}</dd>
            </div>
            {store.phone && (
              <div>
                <dt className="text-slate-400">{t("phone")}</dt>
                <dd>
                  {/* Passa pelo /ir/loja para contar o visitante enviado. */}
                  <a
                    href={`/ir/loja/${store.id}?para=whatsapp`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand-green-dark hover:underline"
                  >
                    {store.phone} · WhatsApp
                  </a>
                </dd>
              </div>
            )}
            {store.website && (
              <div>
                <dt className="text-slate-400">{t("website")}</dt>
                <dd>
                  <a
                    href={`/ir/loja/${store.id}?para=site`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-brand-navy hover:underline"
                  >
                    {store.website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.mapsQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-lg bg-brand-navy px-4 py-2 text-xs font-medium text-white hover:bg-brand-navy-dark"
          >
            {t("viewOnMaps")}
          </a>
        </div>

        <iframe
          title={`Mapa ${store.name}`}
          src={mapSrc}
          className="h-72 w-full rounded-2xl border border-slate-200"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">
        {t("products")} <span className="text-sm font-normal text-slate-400">({products.length})</span>
      </h2>
      {products.length === 0 ? (
        <p className="text-slate-500">{t("noProducts")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((hit) => (
            <ProductCard key={hit.id} hit={hit} locale={locale} rates={rates} fromLabel={th("from")} storesLabel={th("stores")} />
          ))}
        </div>
      )}
    </div>
  );
}
