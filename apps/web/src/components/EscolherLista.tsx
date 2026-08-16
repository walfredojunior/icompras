"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { lerListas, criarLista, alternarNaLista, listasComOProduto, type Lista } from "@/lib/listaLocal";
import { soltarCoracoes } from "@/lib/coracoesVoando";

// ESCOLHER EM QUAL LISTA O PRODUTO ENTRA.
//
// ⚠ POR QUE EXISTE (16/08/2026). O botão chamava `adicionar()` sem dizer a
// lista, e o produto ia **sempre para a primeira criada** — sem escolha e sem
// aviso. Com uma lista só ninguém nota; com duas, fica errado e invisível.
// O dono perguntou: *"se tem mais de uma lista de favoritos, ele sempre vai
// pra primeira lista?"*. Ia.
//
// 💡 SÓ APARECE COM MAIS DE UMA LISTA. Com uma só, o clique continua
// adicionando direto — perguntar "em qual lista?" quando só existe uma é
// atrito puro, e a maioria das pessoas vai ter uma só.
//
// No CELULAR sobe de baixo (padrão do telefone, alvos grandes para o dedo);
// no computador é um menu ancorado no botão. 95% das visitas são de celular.

interface Props {
  produto: { id: number; slug: string; nome: string; imagem: string | null };
  aberto: boolean;
  onFechar: () => void;
  ancora: HTMLElement | null;
  textos: Record<string, string>;
}

export function EscolherLista({ produto, aberto, onFechar, ancora, textos }: Props) {
  const [listas, setListas] = useState<Lista[]>([]);
  const [dentroDe, setDentroDe] = useState<string[]>([]);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const ler = () => { setListas(lerListas()); setDentroDe(listasComOProduto(produto.id)); };
    ler();
    // Fecha ao tocar fora ou apertar Esc — o que a pessoa espera de um menu.
    //
    // ⚠ USA `closest("[data-menu-lista]")`, NÃO a referência do elemento.
    // O mesmo bloco é desenhado DUAS vezes (uma versão para celular, outra
    // para computador), e o React entrega a referência só à última. Clicar na
    // outra contava como "clique fora" e o menu fechava no primeiro toque —
    // dava para marcar uma lista e nunca uma segunda. Achado no teste com
    // navegador em 16/08/2026; a marcação no HTML vale para as duas cópias.
    const fora = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement;
      if (!alvo.closest?.("[data-menu-lista]")) onFechar();
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    // `setTimeout` para o próprio clique que ABRIU o menu não o fechar na hora.
    const t = setTimeout(() => document.addEventListener("mousedown", fora), 0);
    document.addEventListener("keydown", tecla);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, produto.id, onFechar]);

  if (!aberto) return null;

  function marcar(l: Lista, e: React.MouseEvent) {
    const r = alternarNaLista(l.id, produto);
    setDentroDe(listasComOProduto(produto.id));
    // Corações só ao ACRESCENTAR, e curtos: aqui a pessoa pode marcar várias
    // listas seguidas, e o efeito cheio a cada uma cansaria.
    if (r.dentro) soltarCoracoes(e.currentTarget as HTMLElement, false);
  }

  function novaLista() {
    const l = criarLista(nome || textos.novaPadrao);
    alternarNaLista(l.id, produto);
    setListas(lerListas());
    setDentroDe(listasComOProduto(produto.id));
    setNome("");
    setCriando(false);
  }

  const corpo = (
    <div
      ref={caixa}
      data-menu-lista
      className="w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 sm:w-72 sm:rounded-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">{textos.emQualLista}</span>
        <button onClick={onFechar} aria-label={textos.fechar} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="max-h-64 overflow-y-auto">
        {listas.map((l) => {
          const dentro = dentroDe.includes(l.id);
          return (
            <li key={l.id}>
              <button
                onClick={(e) => marcar(l, e)}
                // py-3.5 e não py-2: no celular o alvo precisa de altura para
                // o dedo, senão a pessoa erra a lista de cima.
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{l.nome}</span>
                <span className="text-xs text-slate-400">{l.itens.length}</span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                    dentro ? "border-brand-green bg-brand-green text-white" : "border-slate-300"
                  }`}
                >
                  {dentro && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-slate-100 p-2">
        {criando ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && novaLista()}
              placeholder={textos.novaPadrao}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-green"
            />
            <button onClick={novaLista} className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white">
              {textos.criar}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCriando(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-brand-green-dark hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            {textos.novaLista}
          </button>
        )}
      </div>
    </div>
  );

  // No celular: folha subindo de baixo, com fundo escurecido.
  // No computador: menu ancorado, sem escurecer a tela.
  const r = ancora?.getBoundingClientRect();
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 sm:hidden" onClick={onFechar} aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-50 sm:hidden">{corpo}</div>
      <div
        className="fixed z-50 hidden sm:block"
        style={r ? { top: Math.min(r.bottom + 8, window.innerHeight - 340), left: Math.max(8, Math.min(r.left, window.innerWidth - 300)) } : undefined}
      >
        {corpo}
      </div>
    </>
  );
}
