import { getTranslations } from "next-intl/server";
import { LayoutGrid } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getCategoryTree } from "@/lib/categories";
import { categoryIcon } from "@/lib/categoryIcons";

export async function CategorySidebar({
  activeSlug,
  locale,
}: {
  activeSlug?: string;
  locale: string;
}) {
  const t = await getTranslations("categories");
  const tree = await getCategoryTree(locale);

  const itemBase = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition";
  const inactive = "text-slate-600 hover:bg-slate-50 hover:text-brand-navy";
  const active = "bg-brand-green-light font-medium text-brand-green-dark";

  // Escondida no celular DE PROPÓSITO. Lá o layout empilha, e esta lista
  // (7 grupos + todas as subcategorias do grupo aberto — chega a 57 linhas em
  // Eletrônicos) ficava ANTES das fotos: ao tocar numa subcategoria a pessoa
  // caía em três telas de lista antes de ver o primeiro produto.
  // No celular a navegação fica por conta das pílulas de subcategoria, das
  // migalhas e do botão "Todas as categorias" — todos dentro do conteúdo.
  return (
    <aside className="hidden w-full lg:block lg:w-64 lg:shrink-0">
      <nav className="rounded-2xl border border-slate-200 bg-white p-2 lg:sticky lg:top-20">
        <Link href="/categorias" className={`${itemBase} ${!activeSlug ? active : inactive}`}>
          <LayoutGrid className="h-4 w-4" />
          {t("title")}
        </Link>
        <div className="my-1 border-t border-slate-100" />
        {tree.map((root) => {
          const Icon = categoryIcon(root.slug);
          const rootActive = root.slug === activeSlug;
          const childActive = root.children.some((ch) => ch.slug === activeSlug);
          const expanded = rootActive || childActive;
          return (
            <div key={root.slug}>
              <Link href={`/categorias/${root.slug}`} className={`${itemBase} ${rootActive ? active : inactive}`}>
                <Icon className="h-4 w-4" />
                {root.name}
              </Link>
              {expanded && root.children.length > 0 && (
                <div className="mb-1 ml-5 border-l border-slate-100 pl-2">
                  {root.children.map((ch) => (
                    <Link
                      key={ch.slug}
                      href={`/categorias/${ch.slug}`}
                      className={`${itemBase} ${ch.slug === activeSlug ? active : inactive}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      {ch.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
