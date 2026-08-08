import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getStoresList } from "@/lib/stores";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return paginaMeta({
    locale,
    caminho: "/lojas",
    titulo: t("storesTitle"),
    descricao: t("storesDesc"),
  });
}

const LABELS: Record<string, { title: string; subtitle: (n: number) => string; products: string; empty: string; home: string }> = {
  "pt-BR": {
    title: "Lojas",
    subtitle: (n) => `${n} lojas comparadas no iCompras`,
    products: "produtos",
    empty: "Nenhuma loja ainda — o scraper vai preencher.",
    home: "Início",
  },
  es: {
    title: "Tiendas",
    subtitle: (n) => `${n} tiendas comparadas en iCompras`,
    products: "productos",
    empty: "Ninguna tienda todavía — el scraper la irá completando.",
    home: "Inicio",
  },
  en: {
    title: "Stores",
    subtitle: (n) => `${n} stores compared on iCompras`,
    products: "products",
    empty: "No stores yet — the scraper will fill this in.",
    home: "Home",
  },
};

export default async function LojasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const stores = await getStoresList();
  const t = LABELS[locale] ?? LABELS["pt-BR"];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-400">
        <Link href="/" className="hover:text-brand-navy">
          {t.home}
        </Link>
        <span>›</span>
        <span className="text-slate-500">{t.title}</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{t.subtitle(stores.length)}</p>

      {stores.length === 0 ? (
        <p className="mt-8 text-slate-500">{t.empty}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {stores.map((s) => (
            <Link
              key={s.slug}
              href={`/loja/${s.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-green hover:shadow-sm"
            >
              {s.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo} alt={s.name} className="h-14 w-14 shrink-0 rounded-lg object-contain" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg font-bold text-slate-500">
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800">{s.name}</div>
                <div className="truncate text-xs text-slate-400">
                  {s.city ? `${s.city} · ` : ""}
                  {s.productCount} {t.products}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
