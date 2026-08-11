"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, Clock, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { numeroLocal } from "@/lib/format";

interface Sugestao {
  name: string;
  slug: string;
  image: string | null;
  price: number | null;
  stores: number;
}

const RECENTES = "icompras-buscas-recentes";
const MAX_RECENTES = 5;

const TEXTOS: Record<string, Record<string, string>> = {
  "pt-BR": {
    abrir: "Buscar",
    campo: "Buscar produto, marca ou loja…",
    recentes: "Buscas recentes",
    limpar: "limpar",
    vazio: "Nada encontrado para",
    verTodos: "Ver todos os resultados",
    buscarPor: "Buscar por",
    lojas: "lojas",
    navegar: "navegar",
    abrirItem: "abrir",
    fechar: "fechar",
  },
  es: {
    abrir: "Buscar",
    campo: "Buscar producto, marca o tienda…",
    recentes: "Búsquedas recientes",
    limpar: "limpiar",
    vazio: "No se encontró nada para",
    verTodos: "Ver todos los resultados",
    buscarPor: "Buscar por",
    lojas: "tiendas",
    navegar: "navegar",
    abrirItem: "abrir",
    fechar: "cerrar",
  },
  en: {
    abrir: "Search",
    campo: "Search product, brand or store…",
    recentes: "Recent searches",
    limpar: "clear",
    vazio: "Nothing found for",
    verTodos: "See all results",
    buscarPor: "Search for",
    lojas: "stores",
    navegar: "navigate",
    abrirItem: "open",
    fechar: "close",
  },
};

export function SearchOverlay({ locale }: { locale: string }) {
  const t = TEXTOS[locale] ?? TEXTOS["pt-BR"];
  const router = useRouter();

  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false); // segura a animação de fechar
  const [montado, setMontado] = useState(false);
  const [q, setQ] = useState("");
  const [itens, setItens] = useState<Sugestao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const [recentes, setRecentes] = useState<string[]>([]);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => setMontado(true), []);

  const fechar = useCallback(() => {
    setSaindo(true);
    setTimeout(() => {
      setAberto(false);
      setSaindo(false);
      setQ("");
      setItens([]);
      setMarcado(0);
    }, 140);
  }, []);

  const abrir = useCallback(() => {
    try {
      setRecentes(JSON.parse(localStorage.getItem(RECENTES) ?? "[]"));
    } catch {
      setRecentes([]);
    }
    setAberto(true);
  }, []);

  // Atalhos: "/" e Ctrl+K abrem (quem usa computador espera isso), Esc fecha.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "");
      if (!aberto && !digitando && (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        abrir();
      } else if (aberto && e.key === "Escape") {
        fechar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, abrir, fechar]);

  // Trava a rolagem do fundo enquanto está aberto e põe o cursor no campo.
  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const f = setTimeout(() => campo.current?.focus(), 60);
    return () => {
      document.body.style.overflow = antes;
      clearTimeout(f);
    };
  }, [aberto]);

  // Sugestões, com pausa para não consultar a cada tecla.
  useEffect(() => {
    if (!aberto) return;
    const termo = q.trim();
    if (termo.length < 2) {
      setItens([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const ctrl = new AbortController();
    const tempo = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(termo)}`, { signal: ctrl.signal });
        const j = await r.json();
        setItens(j.items ?? []);
        setMarcado(0);
      } catch {
        /* consulta anterior cancelada */
      } finally {
        setBuscando(false);
      }
    }, 170);
    return () => {
      clearTimeout(tempo);
      ctrl.abort();
    };
  }, [q, aberto]);

  function guardarRecente(termo: string) {
    const lista = [termo, ...recentes.filter((r) => r !== termo)].slice(0, MAX_RECENTES);
    setRecentes(lista);
    try {
      localStorage.setItem(RECENTES, JSON.stringify(lista));
    } catch {
      /* navegador sem armazenamento */
    }
  }

  function irParaBusca(termo: string) {
    const s = termo.trim();
    if (!s) return;
    guardarRecente(s);
    fechar();
    router.push(`/search?q=${encodeURIComponent(s)}`);
  }

  function irParaProduto(s: Sugestao) {
    guardarRecente(q.trim());
    fechar();
    router.push(`/produto/${s.slug}`);
  }

  // ↑ ↓ percorrem a lista; ↵ abre o que está marcado.
  //
  // A posição 0 é a linha "Buscar por «termo»", não um produto — por isso o
  // produto de índice i da lista fica na posição i+1. É o que faz o "Ir" do
  // teclado, com nada escolhido de propósito, cair na BUSCA e não num produto
  // ao acaso.
  function teclas(e: React.KeyboardEvent) {
    const total = itens.length + (itens.length ? 1 : 0); // +1 = linha da busca
    if (e.key === "ArrowDown" && total) {
      e.preventDefault();
      setMarcado((i) => (i + 1) % total);
    } else if (e.key === "ArrowUp" && total) {
      e.preventDefault();
      setMarcado((i) => (i <= 0 ? total - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const escolhido = marcado > 0 ? itens[marcado - 1] : null;
      if (escolhido) irParaProduto(escolhido);
      else irParaBusca(q);
    }
  }

  const preco = (v: number | null) =>
    v == null ? null : `US$ ${numeroLocal(v, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const painel = (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t.abrir}>
      {/* Fundo escurecido e desfocado */}
      <button
        aria-label={t.fechar}
        onClick={fechar}
        className={`absolute inset-0 bg-brand-navy/30 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none ${
          saindo ? "opacity-0" : "opacity-100"
        }`}
        style={{ animation: saindo ? undefined : "icFade .15s ease-out" }}
      />

      {/* Painel */}
      <div
        className={`absolute inset-x-0 top-0 mx-auto w-full max-w-2xl px-3 pt-3 transition-all duration-150 ease-out motion-reduce:transition-none sm:pt-[12vh] ${
          saindo ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{ animation: saindo ? undefined : "icSubir .18s cubic-bezier(.16,1,.3,1)" }}
      >
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5">
          {/* Campo */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-4">
            <Search className={`h-5 w-5 shrink-0 ${buscando ? "animate-pulse text-brand-green" : "text-slate-400"}`} />
            <input
              ref={campo}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={teclas}
              placeholder={t.campo}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-14 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              onClick={fechar}
              aria-label={t.fechar}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Resultados */}
          <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {q.trim().length < 2 && recentes.length > 0 && (
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-xs font-medium text-slate-400">{t.recentes}</span>
                  <button
                    onClick={() => {
                      setRecentes([]);
                      localStorage.removeItem(RECENTES);
                    }}
                    className="text-xs text-slate-400 underline hover:text-slate-600"
                  >
                    {t.limpar}
                  </button>
                </div>
                {recentes.map((r) => (
                  <button
                    key={r}
                    onClick={() => irParaBusca(r)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Clock className="h-4 w-4 shrink-0 text-slate-300" />
                    {r}
                  </button>
                ))}
              </div>
            )}

            {itens.length > 0 && (
              <ul className="p-2">
                {/* PRIMEIRA LINHA: "Buscar por «termo»".
                    A lupa sempre deixou a primeira sugestão marcada, e o "Ir"
                    do teclado abria ELA — quem digitava "pokemon" caía num jogo
                    só e nunca via os 11 resultados. No celular é pior: o
                    teclado cobre a lista e a pessoa nem vê o que foi
                    selecionado. Em vez de tirar o destaque, a primeira linha
                    passou a ser a própria busca — assim o comportamento
                    esperado é o que já estava marcado. É como Google e Amazon
                    resolvem. */}
                <li>
                  <button
                    onMouseEnter={() => setMarcado(0)}
                    onClick={() => irParaBusca(q)}
                    className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                      marcado === 0 ? "bg-brand-green-light" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-100">
                      <Search className="h-5 w-5 text-brand-green-dark" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {t.buscarPor} <span className="text-brand-green-dark">“{q.trim()}”</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">{t.verTodos}</span>
                    </span>
                  </button>
                </li>
                {itens.map((s, iSug) => {
                  // +1 por causa da linha "Buscar por…" que abre a lista.
                  const i = iSug + 1;
                  return (
                  <li key={s.slug}>
                    <button
                      onMouseEnter={() => setMarcado(i)}
                      onClick={() => irParaProduto(s)}
                      className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${
                        i === marcado ? "bg-brand-green-light" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-100">
                        {s.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.image} alt="" className="max-h-11 max-w-11 object-contain" />
                        ) : (
                          <Search className="h-4 w-4 text-slate-300" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-800">{s.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {preco(s.price)}
                          {s.stores > 1 ? ` · ${s.stores} ${t.lojas}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}

            {q.trim().length >= 2 && !buscando && itens.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                {t.vazio} <span className="font-medium text-slate-600">“{q.trim()}”</span>
              </p>
            )}

            {/* Só quando NÃO há sugestões: com elas, a primeira linha da
                lista já é "Buscar por…" e este botão viraria repetição. */}
            {q.trim().length >= 2 && itens.length === 0 && (
              <button
                onClick={() => irParaBusca(q)}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-brand-green-dark transition hover:bg-brand-green-light/50"
              >
                <Search className="h-4 w-4" />
                {t.verTodos} “{q.trim()}”
              </button>
            )}
          </div>

          {/* Dicas de teclado — só onde há teclado. */}
          <div className="hidden items-center gap-4 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-400 sm:flex">
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              <ArrowDown className="h-3 w-3" />
              {t.navegar}
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" />
              {t.abrirItem}
            </span>
            <span className="ml-auto font-mono">esc</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes icFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes icSubir {
          from { opacity: 0; transform: translateY(-10px) scale(.97) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes icSubir { from { opacity: 1 } to { opacity: 1 } }
        }
      `}</style>
    </div>
  );

  return (
    <>
      <button
        onClick={abrir}
        aria-label={t.abrir}
        className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-500 transition hover:border-brand-green hover:text-brand-green-dark sm:pr-2"
      >
        <Search className="h-4 w-4" />
        <span className="hidden text-sm sm:inline">{t.abrir}</span>
        <span className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">
          /
        </span>
      </button>
      {/* Portal: fora da árvore do cabeçalho, senão o fundo desfocado ficaria
          preso dentro dele (o cabeçalho tem backdrop-blur e cria contexto). */}
      {montado && aberto && createPortal(painel, document.body)}
    </>
  );
}
