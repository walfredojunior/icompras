import { Link } from "@/i18n/navigation";
import { blockIcon } from "@/lib/categoryIcons";
import type { CategoryBlock } from "@/lib/blocks";
import { numeroLocal } from "@/lib/format";

// Blocos de destaque por tema na página inicial. Cada bloco reúne várias
// categorias (ex.: "Relógios, Moda e Acessórios" = relógio + óculos + bolsa…),
// mostra as maiores e ilustra com fotos de produtos recentes.
export function CategoryBlocks({
  blocks,
  title,
  locale,
}: {
  blocks: CategoryBlock[];
  title: string;
  locale: string;
}) {
  if (!blocks.length) return null;
  const num = (n: number) => numeroLocal(n, locale);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {blocks.map((b) => {
          const Icon = blockIcon(b.icon);
          const principal = b.categories[0];
          return (
            <div
              key={b.id}
              // min-w-0: sem isso o cartão da grade estica para caber a faixa
              // de categorias inteira em vez de deixá-la rolar.
              className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-green hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-green-light text-brand-green-dark">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{b.title}</h3>
                  {b.subtitle ? <p className="mt-0.5 text-sm text-slate-500">{b.subtitle}</p> : null}
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {num(b.total)}
                </span>
              </div>

              {b.images.length > 0 && (
                <Link
                  href={`/categorias/${principal.slug}`}
                  className="mt-4 grid grid-cols-4 gap-2"
                  aria-label={b.title}
                >
                  {b.images.map((src, i) => (
                    <div key={i} className="flex h-20 items-center justify-center rounded-lg bg-white p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="max-h-full object-contain" />
                    </div>
                  ))}
                </Link>
              )}

              {/* Mesmo tratamento da home: no celular uma linha que rola,
                  no computador quebrando em linhas.
                  SEM margem negativa aqui: dentro de um cartão de grade ela
                  fazia o cartão crescer até caber a faixa inteira (948px numa
                  tela de 390). A faixa rola dentro da área do cartão mesmo. */}
              <div className="relative mt-4">
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
                  {b.categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/categorias/${c.slug}`}
                      className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-brand-green hover:text-brand-green-dark"
                    >
                      {c.name} <span className="text-slate-400">{num(c.count)}</span>
                    </Link>
                  ))}
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent sm:hidden" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
