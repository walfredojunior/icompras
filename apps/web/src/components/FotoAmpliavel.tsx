"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";

// A foto do produto na tela pública, que abre grande quando se clica nela.
//
// ⚠ POR QUE ISTO EXISTE (19/08/2026). Ele pediu: "quando clicar na foto do
// produto, ele aparecer grande". Na tela a foto rende no máximo 240px, e o
// arquivo que já guardamos tem até 550 — o detalhe estava lá e ninguém via.
//
// 💡 O TETO É DA FONTE, NÃO NOSSO, e por isso NÃO há lupa aqui. A fonte publica
// só dois tamanhos: `thumbs/med` (210px) e `thumbs/big` (550px) — medido em
// 19/08 baixando os dois arquivos. Ampliar além de 550 entregaria borrão, e ele
// escolheu a janela simples justamente por isso.
//
// 💡 É uma ILHA DE CLIENTE dentro de uma página de servidor. A página do produto
// continua sendo montada no servidor: na PRIMEIRA abertura (que é a que o Google
// faz) o HTML da foto vem pronto do servidor, e só depois este pedaço ganha o
// clique. Conferido na documentação do Next 16 instalado, em
// `01-getting-started/05-server-and-client-components.md`: o aviso de que
// componente de cliente "renderiza sem HTML do servidor" vale para navegação
// INTERNA, não para a primeira carga.

/**
 * O mesmo arquivo, na maior versão que guardamos.
 *
 * O gerador (`packages/core/src/media/image.ts`) escreve 200, 400 e 800 para
 * toda foto que entra, e **314.773 dos 314.775 produtos com foto** usam
 * exatamente o formato `/media/<hash>/400.webp` (contado no banco em 19/08).
 * Quem estiver fora do padrão fica com o mesmo arquivo — sem ampliação, mas sem
 * quebrar.
 *
 * ⚠ "800" é o teto do gerador, não o tamanho real: ele nunca amplia além do
 * original (`withoutEnlargement`), então na prática esse arquivo tem 550px na
 * maioria dos produtos.
 */
function versaoGrande(url: string): string {
  return url.replace(/\/400\.webp$/, "/800.webp");
}

/** A foto ocupando a tela, sobre fundo escuro. */
function TelaCheia({
  url,
  alt,
  rotuloFechar,
  onFechar,
  onErro,
}: {
  url: string;
  alt: string;
  rotuloFechar: string;
  onFechar: () => void;
  onErro: () => void;
}) {
  // Trava a rolagem do fundo e devolve exatamente como estava — nunca
  // chumbar "auto" no lugar, senão uma tela que rolava de outro jeito perde o
  // comportamento dela ao fechar a foto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", tecla);
    };
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onFechar}
        aria-label={rotuloFechar}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white/90 text-slate-700 transition hover:bg-white"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        // Clicar NA FOTO não fecha; clicar no fundo, sim. Sem isto, quem tenta
        // olhar de perto fecha a janela sem querer.
        onClick={(e) => e.stopPropagation()}
        onError={onErro}
        className="max-h-full max-w-full rounded-lg bg-white object-contain"
      />
    </div>
  );
}

interface Props {
  /** O endereço da foto como está no banco (normalmente `/media/<hash>/400.webp`). */
  url: string;
  alt: string;
  rotuloAmpliar: string;
  rotuloFechar: string;
}

export function FotoAmpliavel({ url, alt, rotuloAmpliar, rotuloFechar }: Props) {
  const [aberta, setAberta] = useState(false);
  // Se a versão grande não existir naquele produto, a janela cai na foto de
  // sempre em vez de mostrar um quadrado quebrado. É seguro por medida (o
  // gerador escreve os três tamanhos), mas custa três linhas ter a rede.
  const [grandeFalhou, setGrandeFalhou] = useState(false);

  const fechar = useCallback(() => setAberta(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-label={rotuloAmpliar}
        className="group relative cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="max-h-60 object-contain" />
        {/* No celular não existe passar o mouse, então a dica fica visível lá —
            senão ninguém descobre que a foto abre. */}
        <span className="pointer-events-none absolute bottom-1 right-1 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100 max-sm:opacity-100">
          <Maximize2 className="h-3 w-3" /> {rotuloAmpliar}
        </span>
      </button>

      {/* A foto grande só é baixada agora, no clique: quem não clicar não paga
          nada na abertura da página. */}
      {aberta && (
        <TelaCheia
          url={grandeFalhou ? url : versaoGrande(url)}
          alt={alt}
          rotuloFechar={rotuloFechar}
          onFechar={fechar}
          onErro={() => setGrandeFalhou(true)}
        />
      )}
    </>
  );
}
