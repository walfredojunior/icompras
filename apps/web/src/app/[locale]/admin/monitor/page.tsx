import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { MonitorVps } from "@/components/MonitorVps";

export default async function AdminMonitorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Monitor VPS</h1>
      <p className="mb-4 text-sm text-slate-500">
        Saúde do servidor onde o iCompras roda. As medidas são coletadas pelo guardião de minuto em
        minuto e guardadas por 90 dias.
      </p>
      <MonitorVps />
    </div>
  );
}
