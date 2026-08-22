"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Search, X } from "lucide-react";

// Escolher UMA categoria entre 519, sem rolar no escuro.
//
// ⚠ POR QUE ISTO EXISTE (21/08/2026). O campo era um `<select>` com todas as
// categorias na ordem em que aparecem no site. Ele pediu: "quando eu for
// escolher a categoria aparecer em ordem alfabética e eu poder procurar
// também". Com 519 opções, isso não é conforto — é a diferença entre a tela
// servir ou não.
//
// 💡 Mostra o TAMANHO de cada categoria (quantos produtos, quantas buscas no
// mês) porque quem está vendendo o espaço precisa do argumento de preço na
// hora da venda, não depois.

export interface CatOpcao {
  slug: string;
  name: string;
  produtos: number;
  buscas: number;
}

/** Quem já ocupa uma categoria, por slug — vem do servidor. */
export type Ocupadas = Record<string, { titulo: string; ate: string | null }>;

export function EscolherCategoria({
  categorias,
  valor,
  onChange,
  ocupadas,
}: {
  categorias: CatOpcao[];
  valor: string;
  onChange: (slug: string) => void;
  ocupadas?: Ocupadas;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const caixa = useRef<HTMLDivElement>(null);

  // Clique fora fecha a lista. Sem isto ela fica pendurada sobre o formulário.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const escolhida = categorias.find((c) => c.slug === valor);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    // Sem busca: as MAIS PROCURADAS primeiro. É o que ele vai vender — perfume
    // e celular estão no topo das buscas do site — e evita rolar até lá.
    if (!termo) {
      const porBusca = [...categorias].sort((a, b) => b.buscas - a.buscas || b.produtos - a.produtos);
      const destaque = porBusca.filter((c) => c.buscas > 0).slice(0, 8);
      const chaves = new Set(destaque.map((c) => c.slug));
      return { destaque, resto: categorias.filter((c) => !chaves.has(c.slug)) };
    }
    // Com busca: alfabética pura, mas quem COMEÇA com o termo vem antes de quem
    // só o contém — procurar "cel" tem de trazer "celular" antes de "acessórios
    // para celular".
    const achados = categorias.filter(
      (c) => c.name.toLowerCase().includes(termo) || c.slug.includes(termo),
    );
    achados.sort((a, b) => {
      const ia = a.name.toLowerCase().startsWith(termo) ? 0 : 1;
      const ib = b.name.toLowerCase().startsWith(termo) ? 0 : 1;
      return ia - ib || a.name.localeCompare(b.name);
    });
    return { destaque: [], resto: achados };
  }, [busca, categorias]);

  function escolher(slug: string) {
    onChange(slug);
    setAberto(false);
    setBusca("");
  }

  const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  function Linha({ c }: { c: CatOpcao }) {
    const ocupada = ocupadas?.[c.slug];
    return (
      <button
        type="button"
        onClick={() => escolher(c.slug)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          {c.slug === valor && <Check className="h-3.5 w-3.5 shrink-0 text-brand-green" />}
          {/* O cadeado NÃO impede escolher: pode ser exatamente o que ele quer,
              para agendar um período seguinte. Quem decide se há conflito é a
              conferência de datas, não esta lista. */}
          {ocupada && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
          <span className="truncate">{c.name}</span>
        </span>
        <span className="shrink-0 text-[11px] text-slate-400">
          {c.produtos.toLocaleString("pt-BR")} prod
          {c.buscas > 0 && ` · ${c.buscas} buscas`}
        </span>
      </button>
    );
  }

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 bg-white text-left ${campo}`}
      >
        <span className="truncate">
          {escolhida ? (
            <>
              {escolhida.name}
              <span className="ml-2 text-[11px] text-slate-400">
                {escolhida.produtos.toLocaleString("pt-BR")} produtos
              </span>
            </>
          ) : (
            <span className="text-slate-400">escolha uma categoria…</span>
          )}
        </span>
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {aberto && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`procurar entre ${categorias.length} categorias…`}
              className="w-full text-sm outline-none"
            />
            {busca && (
              <button type="button" onClick={() => setBusca("")} aria-label="limpar">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {lista.destaque.length > 0 && (
              <>
                <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  mais procuradas no site
                </p>
                {lista.destaque.map((c) => (
                  <Linha key={c.slug} c={c} />
                ))}
                <p className="border-t border-slate-100 px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  todas, de A a Z
                </p>
              </>
            )}
            {lista.resto.map((c) => (
              <Linha key={c.slug} c={c} />
            ))}
            {lista.destaque.length === 0 && lista.resto.length === 0 && (
              <p className="px-3 py-4 text-sm text-slate-400">nenhuma categoria com esse nome.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
