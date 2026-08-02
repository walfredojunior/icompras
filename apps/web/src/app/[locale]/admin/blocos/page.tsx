import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { pool } from "@/lib/db";
import { getBlocksForAdmin } from "@/lib/blocks";
import { BlocksManager } from "@/components/BlocksManager";

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
  const blocks = await getBlocksForAdmin();

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
      />
    </div>
  );
}
