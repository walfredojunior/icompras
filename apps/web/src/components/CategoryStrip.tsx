"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { categoryIcon } from "@/lib/categoryIcons";

export interface ItemDoGrupo {
  slug: string;
  label: string;
}

// Faixa dos grupos: UMA linha, sempre.
//
// Antes quebrava em 3 linhas (138px de altura) porque herdava a largura do
// bloco do título, que é estreito de propósito — mesmo num monitor de 1600px
// ela só tinha 736px. Agora usa a largura da página inteira.
//
// A partir de ~1250px de tela cabe tudo sem rolar. Abaixo disso rola, e aí
// entram as setas: no computador não existe dedo para arrastar, e sem um
// controle visível o que fica à direita simplesmente não é encontrado.
export function CategoryStrip({ todasLabel, itens }: { todasLabel: string; itens: ItemDoGrupo[] }) {
  const faixa = useRef<HTMLDivElement>(null);
  const [temAntes, setTemAntes] = useState(false);
  const [temDepois, setTemDepois] = useState(false);

  function conferir() {
    const el = faixa.current;
    if (!el) return;
    // 2px de folga: navegador arredonda a posição e sem isso a seta pisca no fim.
    setTemAntes(el.scrollLeft > 2);
    setTemDepois(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }

  useEffect(() => {
    conferir();
    const el = faixa.current;
    if (!el) return;
    const ro = new ResizeObserver(conferir);
    ro.observe(el);
    window.addEventListener("resize", conferir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", conferir);
    };
  }, []);

  function rolar(direcao: -1 | 1) {
    const el = faixa.current;
    if (!el) return;
    el.scrollBy({ left: direcao * Math.round(el.clientWidth * 0.7), behavior: "smooth" });
  }

  // Respiro apertado de propósito. Com os valores folgados de antes a faixa
  // pedia 1.205px e o conteúdo da página tem 1.120px — rolaria até num monitor
  // de 1600px, o que seria bobo. Estes 3 ajustes (respiro lateral, espaço entre
  // pílulas e espaço do ícone) economizam ~130px e fazem tudo caber em
  // 1.111px, dentro dos 1.120px que a página tem.
  const pill =
    "group flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition hover:border-brand-green hover:text-brand-green-dark";
  const iconCls = "h-3.5 w-3.5 text-brand-navy transition group-hover:text-brand-green-dark";
  const seta =
    "absolute top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:border-brand-green hover:text-brand-green-dark lg:flex";

  return (
    <div className="relative">
      {temAntes && (
        <>
          <button onClick={() => rolar(-1)} aria-label="Ver grupos anteriores" className={`${seta} -left-1`}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="pointer-events-none absolute inset-y-0 -left-4 z-[5] w-12 bg-gradient-to-r from-white to-transparent sm:left-0" />
        </>
      )}

      {/* No celular a faixa encosta na borda da tela (-mx-4 anula o respiro do
          container): a pílula cortada pela metade é o que avisa que dá para
          arrastar. No computador fica alinhada com o resto da página. */}
      <div
        ref={faixa}
        onScroll={conferir}
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
      >
        <Link href="/categorias" className={pill}>
          <LayoutGrid className={iconCls} />
          {todasLabel}
        </Link>
        {itens.map((c) => {
          const Icon = categoryIcon(c.slug);
          return (
            <Link key={c.slug} href={`/categorias/${c.slug}`} className={pill}>
              <Icon className={iconCls} />
              {c.label}
            </Link>
          );
        })}
      </div>

      {temDepois && (
        <>
          <div className="pointer-events-none absolute inset-y-0 -right-4 z-[5] w-12 bg-gradient-to-l from-white to-transparent sm:right-0" />
          <button onClick={() => rolar(1)} aria-label="Ver mais grupos" className={`${seta} -right-1`}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
