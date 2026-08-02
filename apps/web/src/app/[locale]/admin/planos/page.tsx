import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { getAllPlans } from "@/lib/billing";
import { PlansManager } from "@/components/PlansManager";

export default async function AdminPlanosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const plans = await getAllPlans();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Planos</h1>
      <p className="mb-5 text-sm text-slate-500">
        Cadastre os planos de assinatura (em dólar). O preço anual aplica 10% de desconto automaticamente.
      </p>
      <PlansManager plans={plans} />
    </div>
  );
}
