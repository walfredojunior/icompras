import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { pool } from "@/lib/db";
import { getBlocksForAdmin } from "@/lib/blocks";
import { BlocksManager } from "@/components/BlocksManager";
import { tabelaDePrecos } from "@/lib/precos";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminBlocosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  // Só subcategorias — são elas que têm produto de verdade.
  const categories = await pool.query(
    `SELECT c.id, c.slug, COALESCE(ct.name, c.slug) AS name,
            (SELECT COUNT(*) FROM product p WHERE p.category_id = c.id) AS count,
            (SELECT COALESCE(pt.name, pai.slug) FROM category pai
               LEFT JOIN category_translation pt ON pt.category_id = pai.id AND pt.locale = ?
              WHERE pai.id = c.parent_id) AS \`group\`
       FROM category c
       LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
      WHERE c.parent_id IS NOT NULL
      ORDER BY count DESC, name`,
    [locale, locale],
  );
  const [blocks, stores, precos] = await Promise.all([
    getBlocksForAdmin(),
    pool.query(`SELECT s.id, s.name,
              (
                s.is_lead = 0
                OR EXISTS (SELECT 1 FROM subscription su WHERE su.store_id = s.id)
                OR EXISTS (SELECT 1 FROM pedido pe WHERE pe.store_id = s.id)
              ) AS eh_cliente
         FROM store s WHERE s.status = 'active'
        ORDER BY eh_cliente DESC, s.name LIMIT 1000`),
    tabelaDePrecos(),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Blocos de destaque</h1>
      <p className="mb-4 text-sm text-slate-500">
        Os temas que aparecem na página inicial, em &quot;Mais procurados no Paraguai&quot;.
      </p>
      <BlocksManager
        blocks={blocks as any}
        categories={categories.map((c: any) => ({
          id: Number(c.id),
          slug: c.slug,
          name: c.name,
          count: Number(c.count),
          group: c.group ?? null,
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
