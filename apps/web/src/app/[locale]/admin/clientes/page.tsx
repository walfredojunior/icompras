import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { getClients, type ClientRow } from "@/lib/clients";
import { getAllPlans } from "@/lib/billing";
import { OnboardClient } from "@/components/OnboardClient";

function badge(c: ClientRow): { label: string; cls: string } {
  if (c.status === "canceled") return { label: "Cancelada", cls: "bg-slate-100 text-slate-500" };
  if (c.daysLeft != null && c.daysLeft < -c.graceDays) return { label: "Bloqueada", cls: "bg-red-100 text-red-700" };
  if (c.daysLeft != null && c.daysLeft < 0) return { label: "Vencida (carência)", cls: "bg-amber-100 text-amber-700" };
  if (c.status === "trialing") return { label: "Trial", cls: "bg-brand-navy/10 text-brand-navy" };
  if (c.status === "past_due") return { label: "Atrasada", cls: "bg-amber-100 text-amber-700" };
  return { label: "Ativa", cls: "bg-brand-green-light text-brand-green-dark" };
}

function expiryText(c: ClientRow): string {
  if (c.status === "canceled" || c.daysLeft == null) return "—";
  if (c.daysLeft >= 0) return `vence em ${c.daysLeft} dia(s)`;
  return `venceu há ${Math.abs(c.daysLeft)} dia(s)`;
}

export default async function AdminClientesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const clients = await getClients();
  const plans = (await getAllPlans())
    .filter((p) => p.active)
    .map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-bold text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-500">Lojas com assinatura. Cadastre um cliente, gere a chave de API e registre pagamentos.</p>
      </div>

      <OnboardClient plans={plans} locale={locale} />

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Cobrança</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Vencimento</th>
              <th className="px-4 py-3">Chave</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const b = badge(c);
              return (
                <tr key={c.storeId} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/loja/${c.slug}`} target="_blank" className="flex items-center gap-2 hover:underline" title="Ver página da loja">
                      {c.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logo} alt="" className="h-8 w-8 rounded object-contain" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-500">{c.name.slice(0, 1)}</span>
                      )}
                      <span className="font-medium text-slate-800">{c.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.planName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.interval === "yearly" ? "Anual" : "Mensal"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{expiryText(c)}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.activeKeys > 0 ? <span className="text-brand-green-dark">✓ ativa</span> : <span className="text-slate-400">nenhuma</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/clientes/${c.storeId}`} className="text-xs font-medium text-brand-navy hover:underline">
                      Gerenciar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  Nenhum cliente ainda. Cadastre o primeiro acima.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
