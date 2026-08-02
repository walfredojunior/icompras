"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Search } from "lucide-react";

interface Sugestao {
  name: string;
  slug: string;
}

export function SearchBox({ initial = "" }: { initial?: string }) {
  const t = useTranslations("home");
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [itens, setItens] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [marcado, setMarcado] = useState(-1); // item destacado pelas setas
  const caixa = useRef<HTMLDivElement>(null);

  // Busca as sugestões enquanto digita, com uma pausa para não disparar uma
  // consulta por tecla.
  useEffect(() => {
    const termo = q.trim();
    if (termo.length < 2 || termo === initial) {
      setItens([]);
      return;
    }
    const controle = new AbortController();
    const tempo = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(termo)}`, {
          signal: controle.signal,
        });
        const j = await r.json();
        setItens(j.items ?? []);
        setMarcado(-1);
      } catch {
        /* digitação cancelou a consulta anterior */
      }
    }, 180);
    return () => {
      clearTimeout(tempo);
      controle.abort();
    };
  }, [q, initial]);

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function buscar(termo: string) {
    setAberto(false);
    router.push(`/search?q=${encodeURIComponent(termo.trim())}`);
  }

  function teclas(e: React.KeyboardEvent) {
    if (!aberto || !itens.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarcado((i) => (i + 1) % itens.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcado((i) => (i <= 0 ? itens.length - 1 : i - 1));
    } else if (e.key === "Enter" && marcado >= 0) {
      e.preventDefault();
      setAberto(false);
      router.push(`/produto/${itens[marcado].slug}`);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  }

  const mostrar = aberto && itens.length > 0;

  return (
    <div ref={caixa} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          buscar(q);
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={teclas}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={mostrar}
          className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-base shadow-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/30"
        />
        <button className="rounded-full bg-brand-green px-6 py-3 font-medium text-white shadow-sm hover:bg-brand-green-dark">
          {t("searchButton")}
        </button>
      </form>

      {mostrar && (
        <ul className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          {itens.map((s, i) => (
            <li key={s.slug}>
              <button
                type="button"
                onMouseEnter={() => setMarcado(i)}
                onClick={() => {
                  setAberto(false);
                  router.push(`/produto/${s.slug}`);
                }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${
                  i === marcado ? "bg-slate-50 text-brand-navy" : "text-slate-700"
                }`}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                <span className="truncate">{s.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
