import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { pool } from "@/lib/db";
import { RatesManager } from "@/components/RatesManager";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminCambioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const rates = await pool.query("SELECT currency, pyg_value, source FROM exchange_rate ORDER BY currency");

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Câmbio (moedas)</h1>
      <p className="mb-4 text-sm text-slate-500">
        Base: dólar. Guaraníes por 1 unidade de cada moeda. Atualiza automático 3x/dia; aqui você edita à
        mão ou força a atualização do cambioschaco.
      </p>
      <RatesManager
        rates={rates.map((r: any) => ({ currency: r.currency, pyg_value: Number(r.pyg_value), source: r.source }))}
      />
    </div>
  );
}
