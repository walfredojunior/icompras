import { setRequestLocale } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { getClient, getKeyInfo, getPayments, getStoreProfile } from "@/lib/clients";
import { getAllPlans } from "@/lib/billing";
import { bancardConfigured } from "@/lib/bancard";
import { ClientPanel } from "@/components/ClientPanel";
import { StoreProfileForm } from "@/components/StoreProfileForm";

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export default async function ClientDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const storeId = Number(id);
  const client = await getClient(storeId);
  if (!client) notFound();

  const [keyInfo, payments, allPlans, profile] = await Promise.all([
    getKeyInfo(storeId),
    getPayments(storeId),
    getAllPlans(),
    getStoreProfile(storeId),
  ]);
  const plans = allPlans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly }));

  return (
    <div>
      <Link href="/admin/clientes" className="text-xs text-slate-500 hover:text-brand-navy">
        ← Clientes
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-bold text-slate-900">{client.name}</h1>
      <p className="mb-5 text-sm text-slate-500">
        {client.planName ?? "sem plano"} · {client.interval === "yearly" ? "Anual" : "Mensal"} · vencimento {date(client.periodEnd)}
      </p>
      <div className="space-y-6">
        {profile && <StoreProfileForm storeId={storeId} profile={profile} locale={locale} />}
        <ClientPanel
          client={{
            storeId: client.storeId,
            name: client.name,
            planId: client.planId,
            interval: client.interval,
            status: client.status,
            periodEnd: client.periodEnd,
          }}
          plans={plans}
          keyInfo={keyInfo}
          payments={payments}
          bancardEnabled={bancardConfigured()}
          locale={locale}
        />
      </div>
    </div>
  );
}
