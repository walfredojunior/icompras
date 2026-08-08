import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { Link } from "@/i18n/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AlertsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("alerts");

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/entrar`);

  const rows = await pool.query(
    `SELECT a.id, a.target_price, a.currency, a.channel, p.slug, p.canonical_name AS name
     FROM price_alert a JOIN product p ON p.id = a.product_id
     WHERE a.user_id = ? ORDER BY a.id DESC`,
    [user.id],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t("title")}</h1>
      {rows.length === 0 ? (
        <p className="text-slate-500">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
          {rows.map((a: any) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/produto/${a.slug}`} className="font-medium text-slate-800 hover:text-brand-green-dark">
                {a.name}
              </Link>
              <span className="text-sm text-slate-500">
                {t("target")}: <b className="text-slate-800">{formatPrice(Number(a.target_price), a.currency, locale)}</b>
                {" · "}
                {a.channel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Página de conta: nada a indexar, e algumas exigem senha. `follow` desligado
// porque daqui não sai link que interesse ao buscador.
export const metadata = { robots: { index: false, follow: false } };
