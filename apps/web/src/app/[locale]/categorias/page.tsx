import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CategorySidebar } from "@/components/CategorySidebar";
import { getAllCategories } from "@/lib/categories";
import { categoryIcon } from "@/lib/categoryIcons";

export default async function CategoriasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("categories");
  const cats = await getAllCategories(locale);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <CategorySidebar locale={locale} />
        <div className="flex-1">
          <h1 className="mb-5 text-2xl font-bold text-slate-900">{t("title")}</h1>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {cats.map((c) => {
              const Icon = categoryIcon(c.slug);
              return (
                <Link
                  key={c.slug}
                  href={`/categorias/${c.slug}`}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center transition hover:border-brand-green hover:shadow-sm"
                >
                  <Icon className="h-8 w-8 text-brand-navy" />
                  <span className="font-medium text-slate-800">{c.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
