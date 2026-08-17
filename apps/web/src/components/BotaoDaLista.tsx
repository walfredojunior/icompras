"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Check, Plus } from "lucide-react";
import { adicionar, desmarcarDeTodas, estaEmAlguma, totalDeItens, lerListas, EVENTO } from "@/lib/listaLocal";
import { EscolherLista } from "./EscolherLista";
import { soltarCoracoes } from "@/lib/coracoesVoando";

/**
 * O CONTADOR NO CABEÇALHO.
 *
 * Decisão dele em 15/08/2026: fica no topo, como o carrinho de uma loja. O
 * argumento é que o contador lembra a pessoa de que tem uma lista em andamento
 * — escondido no rodapé, quase ninguém volta nela.
 *
 * ⚠ A lista vive no navegador, então o servidor NÃO sabe quantos itens tem.
 * Isto significa que o número só pode aparecer depois que a página carrega no
 * aparelho da pessoa. Renderizar "0" no servidor e trocar por "3" no navegador
 * causaria o erro de hidratação do React (o famoso "text content did not
 * match") e um pisca-pisca feio. Por isso o `montado`: antes disso, nada é
 * desenhado.
 */
export function ContadorDaLista({ rotulo }: { rotulo: string }) {
  const [montado, setMontado] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    setMontado(true);
    const atualizar = () => setN(totalDeItens());
    atualizar();
    window.addEventListener(EVENTO, atualizar);
    // `storage` pega a mudança feita em OUTRA aba do mesmo site — sem isto,
    // adicionar um produto numa aba deixaria o contador da outra desatualizado.
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  if (!montado) return null;

  return (
    <a
      href="/favoritos"
      className="relative flex items-center gap-1.5 rounded-full px-2 py-1 text-slate-600 transition hover:text-brand-navy"
      aria-label={`${rotulo}${n > 0 ? ` (${n})` : ""}`}
      title={rotulo}
    >
      <Heart className="h-5 w-5" aria-hidden="true" />
      <span className="hidden text-sm lg:inline">{rotulo}</span>
      {n > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-green px-1 text-[11px] font-bold text-white lg:static lg:ml-0.5">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </a>
  );
}

/**
 * O BOTÃO "ADICIONAR À LISTA" que fica no produto e nos cartões.
 *
 * Dá retorno imediato ("Na lista ✓") porque a gravação é no próprio aparelho e
 * leva milissegundos — não há espera de rede para justificar um "carregando".
 */
export function BotaoAdicionar({
  produto,
  rotuloAdd,
  rotuloNaLista,
  rotuloRemover,
  compacto = false,
  textosMenu,
}: {
  produto: { id: number; slug: string; nome: string; imagem: string | null };
  rotuloAdd: string;
  rotuloNaLista: string;
  /** O que o clique FAZ quando já está marcado. Vira o título e o rótulo de
   *  acessibilidade — quem usa leitor de tela precisa saber a ação, não só o
   *  estado. Sem ele, fica o texto de estado (comportamento antigo). */
  rotuloRemover?: string;
  compacto?: boolean;
  /** Textos do menu de escolha. Sem eles o menu não abre (fica o jeito antigo). */
  textosMenu?: Record<string, string>;
}) {
  const [montado, setMontado] = useState(false);
  const [dentro, setDentro] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMontado(true);
    const ver = () => setDentro(estaEmAlguma(produto.id));
    ver();
    window.addEventListener(EVENTO, ver);
    return () => window.removeEventListener(EVENTO, ver);
  }, [produto.id]);

  if (!montado) return null;

  const clicar = (e: React.MouseEvent) => {
    // Nos cartões o botão fica DENTRO do link do produto: sem isto, clicar em
    // "adicionar" navegaria para a página do produto no mesmo gesto.
    e.preventDefault();
    e.stopPropagation();
    // ⚠ COM MAIS DE UMA LISTA, PERGUNTA. Antes o produto ia sempre para a
    // primeira criada, sem escolha e sem aviso — o dono percebeu e estava
    // certo. Com UMA lista só, continua indo direto: perguntar "em qual?"
    // quando só existe uma é atrito à toa.
    if (textosMenu && lerListas().length > 1) {
      setMenuAberto(true);
      return;
    }

    // ⚠ O BOTÃO É UM INTERRUPTOR: se já está marcado, DESMARCA.
    //
    // Até 16/08/2026 clicar de novo chamava `adicionar()` outra vez, que somava
    // mais uma unidade do mesmo produto. O coração acendia e nunca apagava — a
    // única forma de tirar era ir aos favoritos e usar a lixeira. Um botão que
    // parece interruptor e só liga é um botão quebrado. O dono pediu para
    // poder desmarcar, e tinha razão.
    if (dentro) {
      desmarcarDeTodas(produto.id);
      return;
    }

    adicionar(produto);
    // Corações SÓ ao acrescentar — comemorar não combina com desmarcar.
    //
    // `compacto` são os cartões: efeito curto, porque ali a pessoa adiciona
    // vários seguidos varrendo a lista.
    soltarCoracoes(botaoRef.current, !compacto);
  };

  const menu = textosMenu ? (
    <EscolherLista
      produto={produto}
      aberto={menuAberto}
      onFechar={() => setMenuAberto(false)}
      ancora={botaoRef.current}
      textos={textosMenu}
    />
  ) : null;

  if (compacto) {
    return (
      <>
      <button
        ref={botaoRef}
        type="button"
        onClick={clicar}
        aria-label={dentro ? rotuloRemover ?? rotuloNaLista : rotuloAdd}
        title={dentro ? rotuloRemover ?? rotuloNaLista : rotuloAdd}
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
          dentro
            ? "border-brand-green bg-brand-green text-white"
            : "border-slate-200 bg-white/90 text-slate-500 hover:border-brand-green hover:text-brand-green"
        }`}
      >
        {dentro ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
      {menu}
      </>
    );
  }

  return (
    <>
    <button
      ref={botaoRef}
      type="button"
      onClick={clicar}
      title={dentro ? rotuloRemover ?? rotuloNaLista : rotuloAdd}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
        dentro
          ? "border-brand-green bg-brand-green/10 text-brand-green-dark"
          : "border-slate-300 bg-white text-slate-700 hover:border-brand-green hover:text-brand-green-dark"
      }`}
    >
      {dentro ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
      {dentro ? rotuloNaLista : rotuloAdd}
    </button>
    {menu}
    </>
  );
}
