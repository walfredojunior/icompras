import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { getFeaturedProducts } from "@/lib/banners";
import { FeaturedManager } from "@/components/FeaturedManager";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminDestaquesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const featured = await getFeaturedProducts();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Produtos em destaque (home)</h1>
      <p className="mb-4 text-sm text-slate-500">Escolha os produtos que aparecem em destaque na página inicial.</p>
      <FeaturedManager
        featured={featured.map((f: any) => ({ id: Number(f.id), name: f.name, brand: f.brand ?? null }))}
      />
    </div>
  );
}
