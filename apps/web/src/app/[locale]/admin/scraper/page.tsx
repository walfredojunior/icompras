import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { ScraperDashboard } from "@/components/ScraperDashboard";

export default async function AdminScraperPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Scraper</h1>
      <p className="mb-5 text-sm text-slate-500">Andamento do coletor de preços e produtos, ao vivo.</p>
      <ScraperDashboard locale={locale} />
    </div>
  );
}
