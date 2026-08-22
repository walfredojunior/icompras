import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { FeaturedManager } from "@/components/FeaturedManager";
import { pool } from "@/lib/db";
import { tabelaDePrecos } from "@/lib/precos";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminDestaquesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  // Os destaques com os dados de venda: quem paga, até quando, e se já foi
  // lançado na conta.
  const [featured, stores, precos] = await Promise.all([
    pool.query(
      `SELECT p.id, p.canonical_name AS name, p.brand,
              f.store_id, f.is_paid, f.starts_at, f.ends_at,
              s.name AS store_name, v.numero AS pedido_numero
         FROM featured_product f
         JOIN product p ON p.id = f.product_id
         LEFT JOIN store s ON s.id = f.store_id
         LEFT JOIN (
           SELECT i.destaque_produto_id, MIN(pe.numero) AS numero
             FROM pedido_item i JOIN pedido pe ON pe.id = i.pedido_id
            WHERE i.destaque_produto_id IS NOT NULL
            GROUP BY i.destaque_produto_id
         ) v ON v.destaque_produto_id = f.product_id
        ORDER BY f.position, p.id`,
    ),
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

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Produtos em destaque (home)</h1>
      <p className="mb-4 text-sm text-slate-500">Escolha os produtos que aparecem em destaque na página inicial.</p>
      <FeaturedManager
        featured={featured.map((f: any) => ({
          id: Number(f.id),
          name: f.name,
          brand: f.brand ?? null,
          store_name: f.store_name ?? null,
          is_paid: Number(f.is_paid ?? 0),
          starts_at: f.starts_at ?? null,
          ends_at: f.ends_at ?? null,
          pedido_numero: f.pedido_numero ?? null,
        }))}
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
