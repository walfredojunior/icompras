import { Link } from "@/i18n/navigation";

// Anterior / Página X de Y / Próxima.
// Usada na busca e nas categorias — sem isso a listagem mostrava só a
// primeira leva e o resto do catálogo ficava inalcançável.
export function Paginacao({
  page,
  pages,
  href,
  labels,
}: {
  page: number;
  pages: number;
  href: (p: number) => string;
  labels: { previous: string; next: string; pageOf: string };
}) {
  if (pages <= 1) return null;
  const botao = "rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-brand-green";
  const inativo = "rounded-lg border border-slate-100 px-4 py-2 text-sm text-slate-300";

  return (
    <nav className="mt-8 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className={botao}>
          ← {labels.previous}
        </Link>
      ) : (
        <span className={inativo}>← {labels.previous}</span>
      )}
      <span className="text-sm text-slate-500">{labels.pageOf}</span>
      {page < pages ? (
        <Link href={href(page + 1)} className={botao}>
          {labels.next} →
        </Link>
      ) : (
        <span className={inativo}>{labels.next} →</span>
      )}
    </nav>
  );
}
