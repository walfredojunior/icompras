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
      {/* A marca da casa para IA é PYIA — pedido dele em 11/08/2026: "onde
          tiver prompt de IA coloca aí PYIA e a logo". A logo é a mesma da
          home: animada dentro do próprio .svg, entra como imagem, sem script. */}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pyia-animado.svg" alt="PYIA" className="h-10 w-10 object-contain" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">PYIA</h1>
          <p className="text-xs text-slate-400">a inteligência artificial do iCompras</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">
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
