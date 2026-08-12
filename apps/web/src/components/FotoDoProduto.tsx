"use client";

import { useEffect, useState } from "react";
import { ImageOff, Maximize2, Undo2, X } from "lucide-react";

// A foto no editor de produto da loja — grande, e com como julgá-la.
//
// ⚠ POR QUE ISTO EXISTE (12/08/2026). A miniatura tinha **96 pixels**, e ele
// disse o essencial: "a foto do produto é muito pequena, tinha que ser bem
// maior pra poder ver a qualidade". Em 96px não dá para julgar nada — nem se a
// foto está borrada, nem se o fundo ficou branco de verdade.
//
// Quem usa é o CLIENTE da loja, em **PC ou tablet grande** (definido por ele).
// Então a tela pode usar a largura, em vez de espremer tudo numa coluna.

/** Xadrez claro atrás da foto. */
//
// 💡 Não é enfeite: sobre o cartão branco da tela, fundo branco e fundo
// TRANSPARENTE são idênticos a olho nu. O xadrez é o que revela a diferença —
// e essa diferença é justamente o que o botão "melhorar a foto" resolve.
const XADREZ =
  "repeating-conic-gradient(#f1f5f9 0% 25%, #ffffff 0% 50%) 50% / 16px 16px";

interface Props {
  /** A foto que está no formulário agora. */
  atual: string;
  /** A que havia antes de a PYIA mexer. Null = não houve mudança. */
  anterior: string | null;
  onDesfazer: () => void;
}

/** Largura × altura reais e o peso do arquivo. */
function useDadosDaImagem(url: string) {
  const [dados, setDados] = useState<{ l: number; a: number; kb: number | null } | null>(null);

  useEffect(() => {
    if (!url) return setDados(null);
    let vivo = true;
    const img = new Image();
    img.onload = () => {
      if (!vivo) return;
      setDados({ l: img.naturalWidth, a: img.naturalHeight, kb: null });
      // O peso vem num pedido só de cabeçalho — nada é baixado de novo.
      fetch(url, { method: "HEAD" })
        .then((r) => {
          const n = Number(r.headers.get("content-length"));
          if (vivo && Number.isFinite(n) && n > 0) {
            setDados({ l: img.naturalWidth, a: img.naturalHeight, kb: Math.round(n / 1024) });
          }
        })
        .catch(() => {});
    };
    img.onerror = () => vivo && setDados(null);
    img.src = url;
    return () => {
      vivo = false;
    };
  }, [url]);

  return dados;
}

/** A foto ocupando a tela, para ver no tamanho real. */
function TelaCheia({ url, onFechar }: { url: string; onFechar: () => void }) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onFechar}
    >
      <button
        onClick={onFechar}
        aria-label="Fechar"
        className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-lg bg-white/90 text-slate-700 hover:bg-white"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain"
        style={{ background: XADREZ }}
      />
    </div>
  );
}

function Quadro({
  url,
  rotulo,
  grande,
  onAmpliar,
}: {
  url: string;
  rotulo?: string;
  grande: boolean;
  onAmpliar?: () => void;
}) {
  const dados = useDadosDaImagem(url);
  return (
    <div className={grande ? "" : "w-32 shrink-0"}>
      {rotulo && <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{rotulo}</p>}
      <button
        type="button"
        onClick={onAmpliar}
        disabled={!onAmpliar}
        className={`group relative block w-full overflow-hidden rounded-xl border border-slate-200 ${
          grande ? "aspect-square" : "aspect-square"
        } ${onAmpliar ? "cursor-zoom-in" : "cursor-default"}`}
        style={{ background: XADREZ }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-contain" />
        {onAmpliar && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
            <Maximize2 className="h-3 w-3" /> tamanho real
          </span>
        )}
      </button>
      {/* Os números dizem objetivamente o que o olho não garante: foto de
          300px esticada não engana quando a medida está escrita. */}
      <p className="mt-1 text-[11px] text-slate-400">
        {dados ? `${dados.l} × ${dados.a}${dados.kb ? ` · ${dados.kb} KB` : ""}` : "carregando…"}
      </p>
    </div>
  );
}

export function FotoDoProduto({ atual, anterior, onDesfazer }: Props) {
  const [cheia, setCheia] = useState(false);

  if (!atual) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-300"
        style={{ background: XADREZ }}
      >
        <span className="flex flex-col items-center gap-2 text-xs text-slate-400">
          <ImageOff className="h-8 w-8" />
          sem foto
        </span>
      </div>
    );
  }

  return (
    <>
      {/* ANTES E DEPOIS, quando a PYIA mexeu na foto.
          Sem isto, o botão "melhorar a foto" troca a imagem e não sobra com o
          que comparar — e comparar é exatamente o que aquele botão pede. */}
      {anterior && anterior !== atual ? (
        <div>
          <div className="flex items-start gap-3">
            <Quadro url={anterior} rotulo="antes" grande={false} />
            <div className="min-w-0 flex-1">
              <Quadro url={atual} rotulo="depois" grande onAmpliar={() => setCheia(true)} />
            </div>
          </div>
          <button
            type="button"
            onClick={onDesfazer}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-400"
          >
            <Undo2 className="h-3.5 w-3.5" />
            voltar para a foto anterior
          </button>
        </div>
      ) : (
        <Quadro url={atual} grande onAmpliar={() => setCheia(true)} />
      )}

      {cheia && <TelaCheia url={atual} onFechar={() => setCheia(false)} />}
    </>
  );
}
