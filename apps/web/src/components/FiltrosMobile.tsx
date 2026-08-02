"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X, Check } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { buildHref } from "@/lib/urlFiltros";

export interface FiltrosLabels {
  filters: string;
  brand: string;
  priceRange: string;
  min: string;
  max: string;
  clear: string;
  showResults: string; // já vem com o número formatado no idioma
}

// Filtros do celular num painel que sobe de baixo.
//
// A barra lateral do computador ocupava 672px ANTES dos resultados no
// celular — mais de uma tela inteira de filtros antes do primeiro produto.
// Aqui vira um botão discreto que mostra quantos filtros estão ativos.
//
// As marcas são escolhidas em conjunto e aplicadas de uma vez só (um
// carregamento em vez de um por marca).
export function FiltrosMobile({
  labels,
  brands,
  params,
  activeBrands,
  base = "/search",
}: {
  labels: FiltrosLabels;
  brands: Array<{ value: string; count: number }>;
  params: Record<string, string | undefined>;
  activeBrands: string[];
  base?: string;
}) {
  const router = useRouter();
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [marcas, setMarcas] = useState<string[]>(activeBrands);
  const [min, setMin] = useState(params.min ?? "");
  const [max, setMax] = useState(params.max ?? "");

  useEffect(() => setMontado(true), []);

  const ativos = activeBrands.length + (params.min ? 1 : 0) + (params.max ? 1 : 0);

  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [aberto]);

  function fechar() {
    setSaindo(true);
    setTimeout(() => {
      setSaindo(false);
      setAberto(false);
    }, 160);
  }

  function abrir() {
    setMarcas(activeBrands);
    setMin(params.min ?? "");
    setMax(params.max ?? "");
    setAberto(true);
  }

  function aplicar() {
    const href = buildHref(
      params,
      { brand: marcas.join("|") || null, min: min || null, max: max || null },
      base,
    );
    fechar();
    router.push(href);
  }

  function limpar() {
    setMarcas([]);
    setMin("");
    setMax("");
  }

  const campo = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base";

  const painel = (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={labels.filters}>
      <button
        aria-label="fechar"
        onClick={fechar}
        className={`absolute inset-0 bg-brand-navy/30 backdrop-blur-sm transition-opacity duration-150 ${
          saindo ? "opacity-0" : "opacity-100"
        }`}
        style={{ animation: saindo ? undefined : "icFundo .15s ease-out" }}
      />
      <div
        className={`absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-150 ease-out ${
          saindo ? "translate-y-full" : "translate-y-0"
        }`}
        style={{ animation: saindo ? undefined : "icSubirDeBaixo .22s cubic-bezier(.16,1,.3,1)" }}
      >
        {/* Puxador */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-base font-semibold text-slate-900">{labels.filters}</span>
          <button onClick={fechar} aria-label="fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <span className="text-sm font-medium text-slate-700">{labels.priceRange}</span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder={labels.min}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className={campo}
            />
            <span className="text-slate-300">–</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={labels.max}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className={campo}
            />
          </div>

          {brands.length > 0 && (
            <>
              <span className="mt-6 block text-sm font-medium text-slate-700">{labels.brand}</span>
              <ul className="mt-2 space-y-1">
                {brands.map((b) => {
                  const on = marcas.includes(b.value);
                  return (
                    <li key={b.value}>
                      <button
                        onClick={() =>
                          setMarcas((m) => (on ? m.filter((x) => x !== b.value) : [...m, b.value]))
                        }
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition ${
                          on ? "bg-brand-green-light" : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            on ? "border-brand-green bg-brand-green text-white" : "border-slate-300"
                          }`}
                        >
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className={`min-w-0 flex-1 truncate text-sm ${on ? "font-medium text-brand-green-dark" : "text-slate-700"}`}>
                          {b.value}
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">{b.count.toLocaleString()}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Ações fixas no rodapé, na altura do polegar. */}
        <div
          className="flex shrink-0 items-center gap-3 border-t border-slate-100 p-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={limpar}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:border-slate-300"
          >
            {labels.clear}
          </button>
          <button
            onClick={aplicar}
            className="flex-1 rounded-xl bg-brand-green px-4 py-3 text-sm font-semibold text-white hover:bg-brand-green-dark"
          >
            {labels.showResults}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes icFundo { from { opacity: 0 } to { opacity: 1 } }
        @keyframes icSubirDeBaixo { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes icSubirDeBaixo { from { transform: none } to { transform: none } }
        }
      `}</style>
    </div>
  );

  return (
    <>
      <button
        onClick={abrir}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition lg:hidden ${
          ativos
            ? "border-brand-green bg-brand-green-light font-medium text-brand-green-dark"
            : "border-slate-200 text-slate-600"
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {labels.filters}
        {ativos > 0 && (
          <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-green px-1 text-[10px] font-bold text-white">
            {ativos}
          </span>
        )}
      </button>
      {montado && aberto && createPortal(painel, document.body)}
    </>
  );
}
