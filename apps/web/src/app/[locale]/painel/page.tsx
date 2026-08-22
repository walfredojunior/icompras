import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/storeauth";
import { pool } from "@/lib/db";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { PlanPicker } from "@/components/PlanPicker";
import { StoreMenu } from "@/components/StoreMenu";
import { MeusBanners } from "@/components/MeusBanners";
import { Link } from "@/i18n/navigation";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function PanelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("panel");

  const store = await getCurrentStore();
  if (!store) redirect(`/${locale}/painel/entrar`);

  const plans = await pool.query(
    "SELECT id, name, price_monthly, currency, max_products FROM plan WHERE active = 1 ORDER BY price_monthly",
  );
  const sub = await pool.query(
    `SELECT s.plan_id, pl.name FROM subscription s JOIN plan pl ON pl.id = s.plan_id
     WHERE s.store_id = ? AND s.status IN ('active','trialing') ORDER BY s.id DESC LIMIT 1`,
    [store.id],
  );
  const keyCount = await pool.query("SELECT COUNT(*) AS c FROM api_key WHERE store_id = ? AND revoked = 0", [store.id]);
  const offerCount = await pool.query("SELECT COUNT(*) AS c FROM offer WHERE store_id = ?", [store.id]);

  const currentPlanId = sub.length ? Number(sub[0].plan_id) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
        <StoreMenu name={store.name} logoutLabel={t("logout")} />
      </div>

      {/* Os anúncios da loja, quando ela tem algum. O componente se esconde
          sozinho se não houver nenhum — quem nunca comprou não precisa de uma
          caixa vazia dizendo que não tem. */}
      <div className="mt-6">
        <MeusBanners storeId={Number(store.id)} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm text-slate-400">{t("currentPlanLabel")}</div>
          <div className="text-xl font-semibold text-slate-900">{sub.length ? sub[0].name : t("noPlan")}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm text-slate-400">{t("offersLabel")}</div>
          <div className="text-xl font-semibold text-slate-900">{Number(offerCount[0].c)}</div>
        </div>
      </div>

      {/* Caminho para a tela de produtos. Vem ANTES da chave da API de
          propósito: a chave é coisa de quem integra uma vez e nunca mais; esta
          é a tela do dia a dia de quem precisa completar foto e liberar. */}
      <Link
        href="/painel/produtos"
        className="mt-6 flex items-center justify-between rounded-2xl border border-brand-green/40 bg-brand-green/5 p-5 transition hover:border-brand-green"
      >
        <span>
          <span className="block font-semibold text-slate-900">Meus produtos</span>
          <span className="mt-0.5 block text-sm text-slate-600">
            Complete foto, descrição e ficha, e libere o que aparece no iCompras.
          </span>
        </span>
        <span className="text-brand-green-dark">›</span>
      </Link>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">{t("apiKeyTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("apiKeyDesc")}</p>
        <div className="mt-3">
          <ApiKeyManager
            hasKey={Number(keyCount[0].c) > 0}
            dict={{ generate: t("generate"), regenerate: t("regenerate"), warning: t("keyWarning"), none: t("keyNone") }}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{t("plansTitle")}</h2>
        <PlanPicker
          plans={plans.map((p: any) => ({
            id: Number(p.id),
            name: p.name,
            price_monthly: Number(p.price_monthly),
            currency: p.currency,
            max_products: Number(p.max_products),
          }))}
          currentPlanId={currentPlanId}
          locale={locale}
          dict={{
            subscribe: t("subscribe"),
            current: t("current"),
            unlimited: t("unlimited"),
            productsLabel: t("products"),
            perMonth: t("perMonth"),
          }}
        />
      </section>
    </div>
  );
}

// Página de conta: nada a indexar, e algumas exigem senha. `follow` desligado
// porque daqui não sai link que interesse ao buscador.
export const metadata = { robots: { index: false, follow: false } };
