"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Câmera ao vivo da Ponte da Amizade — faixa na home + vídeo em tela grande.
//
// HISTÓRICO DAS DECISÕES (08/08/2026), que explica cada escolha:
//
// 1ª versão: caixa flutuante com a imagem da ponte sempre visível. Mostrava
// mais, mas COBRIA CONTEÚDO — e no celular, que é a maior parte das visitas,
// isso pesa. O dono olhou e pediu o contrário: um selo pequeno no topo.
//
// 2ª versão: a faixa + um player pequeno no canto (210/300px). Errado pelo
// outro lado: numa câmera de trânsito o que importa é enxergar SE A FILA ANDA,
// e nesse tamanho não dá. Dimensionei para "não atrapalhar" quando o vídeo era
// justamente o objetivo.
//
// 3ª e atual: tela grande com fundo escuro, e a página PARA atrás. A frase do
// dono que fechou a questão: **"a pessoa ou vê a fila ou vê a ponte, os dois
// não"**. Quem está olhando o trânsito não está comprando, e quem está
// comprando não quer vídeo por cima. Um player grande flutuando enquanto a
// pessoa rola a página seria pior que o problema original.

interface Props {
  embed: string;
  capa: string | null;
  titulo: string;
  /** Endereço contado, para saber quantos abriram. */
  href: string | null;
}

export function AoVivo({ embed, capa, titulo, href }: Props) {
  const [aberto, setAberto] = useState(false);

  // Trava a rolagem do fundo enquanto o vídeo está aberto — o mesmo que o menu
  // do celular já faz. Sem isto, arrastar o dedo move a página atrás do vídeo e
  // dá sensação de coisa quebrada.
  useEffect(() => {
    if (!aberto) return;
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Esc fecha: com o vídeo ocupando a tela, quem só tem o X se sente preso.
    const naTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", naTecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener("keydown", naTecla);
    };
  }, [aberto]);

  function abrir() {
    setAberto(true);
    // Não bloqueia a abertura: se a contagem falhar, o vídeo abre do mesmo jeito.
    if (href) void fetch(href, { method: "GET", keepalive: true }).catch(() => {});
  }

  return (
    <>
      {/* A FAIXA. Fininha, largura toda, logo abaixo do cabeçalho.
          Não entrou DENTRO do cabeçalho de propósito: aquele componente é o
          mesmo em todas as páginas, e isto é só da home. */}
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-1.5">
          <button
            onClick={abrir}
            className="group flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:text-brand-navy"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span>Ao vivo</span>
            {/* O nome AGORA APARECE TAMBÉM NO CELULAR. Eu tinha escondido por
                receio de espaço; ele conferiu na tela e cabe — a faixa é uma
                linha só dela, então o espaço é dela. */}
            <span className="text-slate-400 group-hover:text-brand-navy">· {titulo}</span>
          </button>
        </div>
      </div>

      {/* O VÍDEO. Só existe depois do clique: antes disso a home não carrega um
          byte do YouTube (o iframe deles pesa ~1,5 MB, e a home é a página que
          o Google acabou de começar a rastrear).

          z-50: cobre o cabeçalho (z-40) e fica ABAIXO do menu do celular e da
          busca (z-[60]). Assim o menu vence sem eu precisar de código
          coordenando os dois — e, como o fundo escuro cobre o cabeçalho, a
          pessoa nem alcança o botão do menu enquanto o vídeo está aberto. */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6"
          // Fechar tocando no fundo. É o gesto que todo mundo tenta primeiro.
          onClick={() => setAberto(false)}
        >
          <div
            className="w-full max-w-[860px] overflow-hidden rounded-xl bg-white shadow-2xl"
            // O clique no vídeo não pode fechar — só o clique no FUNDO.
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra branca ACIMA do vídeo, não sobre ele. Em cima da imagem, o
                X disputaria espaço com os botões do próprio YouTube e sumiria
                no céu claro do enquadramento. */}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                <span className="truncate text-sm font-semibold text-slate-800">{titulo}</span>
              </span>
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar vídeo"
                // 40px e fundo cinza: ele pediu "um X que dê pra ver". Alvo
                // grande é o que salva no celular, onde se erra com o polegar.
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 16:9. No celular ocupa a largura toda; no computador para em
                860px — cerca de 480px de altura, grande o bastante para ver
                caminhão e fila, e travado aí para não virar exagero num monitor
                grande.

                Quem quiser a tela inteira usa o botão do próprio YouTube, que
                já vem no player: não há por que reinventar isso. */}
            <div className="relative aspect-video w-full bg-slate-900">
              {/* A capa fica embaixo enquanto o player carrega, para não dar o
                  retângulo preto de um ou dois segundos. */}
              {capa && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={capa} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <iframe
                src={embed}
                title={titulo}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
