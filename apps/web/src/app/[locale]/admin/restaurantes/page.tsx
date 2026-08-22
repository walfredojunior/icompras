import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { pool } from "@/lib/db";
import { listarParaAdmin, TIPOS, rotuloDoTipo } from "@/lib/restaurantes";
import { tabelaDePrecos } from "@/lib/precos";
import { RestaurantesManager } from "@/components/RestaurantesManager";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminRestaurantesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const [restaurantes, stores, precos] = await Promise.all([
    listarParaAdmin(),
    // Mesma separação das outras telas: clientes primeiro, leads depois.
    pool.query(
      `SELECT s.id, s.name,
              (
                s.is_lead = 0
                OR EXISTS (SELECT 1 FROM subscription su WHERE su.store_id = s.id)
                OR EXISTS (SELECT 1 FROM pedido pe WHERE pe.store_id = s.id)
              ) AS eh_cliente
         FROM store s WHERE s.status = 'active'
        ORDER BY eh_cliente DESC, s.name LIMIT 1000`,
    ),
    tabelaDePrecos(),
  ]);

  const noAr = restaurantes.filter((r) => r.active === 1).length;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-slate-900">Onde comer no Paraguai</h1>
        <Link
          href="/onde-comer"
          className="text-xs font-medium text-brand-navy hover:underline"
          target="_blank"
        >
          ver a página no site →
        </Link>
      </div>
      <p className="mb-5 text-sm text-slate-500">
        O guia de restaurantes. {noAr} no ar de {restaurantes.length} cadastrados. Aparece na página
        inicial como um bloco que reveza, e a lista completa fica em /onde-comer.
      </p>

      <RestaurantesManager
        restaurantes={restaurantes as any}
        tipos={TIPOS.map((x) => ({ id: x.id, rotulo: rotuloDoTipo(x.id, locale) }))}
        stores={stores.map((s: any) => ({
          id: Number(s.id),
          name: s.name,
          ehCliente: Number(s.eh_cliente ?? 0) === 1,
        }))}
        precos={precos as any}
      />
    </div>
  );
}
