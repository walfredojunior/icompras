import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { verConfig } from "@/lib/iaConfig";
import { IaSettings } from "@/components/IaSettings";
import { AjudaIa } from "@/components/AjudaIa";

export default async function AdminIaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  // `verConfig` já devolve as chaves mascaradas — o valor inteiro não sai do
  // servidor nem para o admin logado.
  const inicial = await verConfig();

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Inteligência artificial</h1>
      <p className="mt-1 text-sm text-slate-500">
        Chaves, modelos e <strong>tetos de gasto</strong> dos serviços de IA. A conta é sua — os tetos são o
        que impede uma tela em laço de consumir saldo sem ninguém ver.
      </p>
      <div className="mt-6">
        <IaSettings inicial={inicial} />
      </div>
      <AjudaIa />
    </div>
  );
}
