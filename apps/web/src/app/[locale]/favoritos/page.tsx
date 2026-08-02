import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getFavorites } from "@/lib/favorites";
import { getRates } from "@/lib/rates";
import { MoneyStack } from "@/components/MoneyStack";

export default async function FavoritosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/entrar`);

  const t = await getTranslations("product");
  const th = await getTranslations("home");
  const itens = await getFavorites(user.id);
  const rates = await getRates();

  const titulo = locale === "es" ? "Mis favoritos" : locale === "en" ? "My saved items" : "Meus favoritos";
  const vazio =
    locale === "es"
      ? "Todavía no guardaste nada. Abrí un producto y tocá el corazón."
      : locale === "en"
        ? "Nothing saved yet. Open a product and tap the heart."
        : "Você ainda não guardou nada. Abra um produto e toque no coração.";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
        <Heart className="h-6 w-6 fill-red-500 text-red-500" />
        {titulo}
        <span className="text-sm font-normal text-slate-400">({itens.length})</span>
      </h1>

      {itens.length === 0 ? (
        <p className="mt-6 text-slate-500">{vazio}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {itens.map((p) => (
            <Link
              key={p.id}
              href={`/produto/${p.slug}`}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-brand-green hover:shadow-sm"
            >
              <div className="flex h-40 items-center justify-center bg-white">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.name} className="max-h-40 object-contain" />
                ) : (
                  <span className="text-3xl font-bold text-slate-300">{(p.brand || p.name).slice(0, 1)}</span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <span className="line-clamp-2 text-sm font-medium text-slate-800">{p.name}</span>
                <div className="mt-auto pt-2">
                  <span className="text-xs text-slate-400">{th("from")}</span>
                  <MoneyStack usd={p.minUsd} rates={rates} locale={locale} size="sm" />
                  <p className="mt-1 text-xs text-slate-400">
                    {p.stores} {t("storesCount").toLowerCase()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
