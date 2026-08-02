import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { pool } from "@/lib/db";
import { getAllBanners } from "@/lib/banners";
import { BannerManager } from "@/components/BannerManager";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminBannersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const categories = await pool.query(
    `SELECT c.slug, COALESCE(ct.name, c.slug) AS name
     FROM category c LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
     ORDER BY c.position`,
    [locale],
  );
  // Lojas que podem ser ligadas a um banner.
  //
  // ANTES era `WHERE is_lead = 0`, e isso mostrava só as 4 lojas de TESTE: as
  // 142 lojas de verdade entram pelo coletor marcadas como lead (são possíveis
  // clientes) e ficavam todas de fora. Na prática a caixinha era inútil.
  // Agora entra toda loja ativa que tenha produto no site.
  const stores = await pool.query(
    `SELECT s.id, s.name
       FROM store s
      WHERE s.status = 'active'
        AND EXISTS (SELECT 1 FROM product_store ps WHERE ps.store_id = s.id)
      ORDER BY s.name
      LIMIT 500`,
  );
  const banners = await getAllBanners();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Banners</h1>
      <BannerManager
        banners={banners as any}
        categories={categories.map((c: any) => ({ slug: c.slug, name: c.name }))}
        stores={stores.map((s: any) => ({ id: Number(s.id), name: s.name }))}
      />
    </div>
  );
}
