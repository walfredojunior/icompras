"use client";

import { useEffect } from "react";
import { ArrowUpRight, MessageCircle, Store, X } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ProductStore } from "@/lib/products";

// O DETALHE DE UMA OFERTA, sem sair da página.
//
// Pedido do dono em 06/08/2026, inspirado no comprasparaguai: "clicar no
// produto e aparecer a foto com descrição, código da loja, preço com link do
// site da loja e especificação". Lá o clique LEVA para outra página.
//
// Aqui é painel, e a diferença importa: quem está nesta lista está COMPARANDO.
// Abre, olha, fecha, abre a próxima. Trocar de página a cada olhada quebra a
// comparação — é justamente o que torna a experiência da fonte cansativa.
//
// No celular sobe de baixo (é onde o polegar alcança); no computador entra
// pela direita. Mesmo componente, duas ancoragens.

export interface DicionarioOferta {
  code: string;
  seeInStore: string;
  seeStore: string;
  whatsapp: string;
  close: string;
  specs: string;
  soldBy: string;
  noLink: string;
}

export function OfertaDetalhe({
  oferta,
  productName,
  productImage,
  specs,
  precoFmt,
  dict,
  onClose,
}: {
  oferta: ProductStore | null;
  productName: string;
  productImage: string | null;
  specs: Array<{ k: string; v: string }>;
  /** Formatação vem pronta de fora: o painel não sabe de câmbio. */
  precoFmt: (usd: number) => { usd: string; brl: string; pyg: string };
  dict: DicionarioOferta;
  onClose: () => void;
}) {
  // Esc fecha, e o fundo para de rolar enquanto o painel está aberto —
  // sem isso, no celular, a lista corre atrás do painel e o visitante perde
  // o lugar onde estava.
  useEffect(() => {
    if (!oferta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [oferta, onClose]);

  if (!oferta) return null;

  const foto = oferta.offerImage ?? productImage;
  const titulo = oferta.offerTitle ?? productName;
  const preco = oferta.priceUsd != null ? precoFmt(oferta.priceUsd) : null;
  const temLink = Boolean(oferta.storeUrl && oferta.offerId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={dict.close}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />

      <div className="relative flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-3xl">
        {/* Alça de arrastar — só no celular, onde a gente espera puxar. */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" />

        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            {oferta.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={oferta.logo} alt={oferta.name} className="h-7 w-16 shrink-0 object-contain" />
            ) : (
              <Store className="h-4 w-4 shrink-0 text-slate-400" />
            )}
            <span className="truncate text-sm font-semibold text-slate-900">{oferta.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.close}
            className="-mr-1 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <div className="flex h-52 items-center justify-center rounded-2xl bg-slate-50">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt={titulo} className="max-h-full max-w-full object-contain p-4" />
            ) : (
              <span className="text-5xl font-bold text-slate-200">{oferta.name.slice(0, 1)}</span>
            )}
          </div>

          {/* O título como AQUELA loja anuncia — não o nosso nome canônico.
              É o que o visitante vai reencontrar no site dela. */}
          <p className="mt-4 text-[15px] font-medium leading-snug text-slate-900">{titulo}</p>

          {oferta.offerCode && (
            <p className="mt-1 text-xs text-slate-400">
              {dict.code}: <span className="font-mono">{oferta.offerCode}</span>
            </p>
          )}

          {preco && (
            <div className="mt-4 rounded-2xl bg-brand-green/5 px-4 py-3">
              <div className="text-2xl font-bold text-brand-green-dark">{preco.usd}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {preco.brl} · {preco.pyg}
              </div>
            </div>
          )}

          {specs.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{dict.specs}</h3>
              <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 text-xs">
                {specs.slice(0, 8).map((e) => (
                  <div key={e.k} className="flex gap-3 px-3 py-2">
                    <dt className="w-28 shrink-0 text-slate-400">{e.k}</dt>
                    <dd className="min-w-0 flex-1 text-slate-700">{e.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* Ações grudadas embaixo: no celular é onde o polegar chega, e no
            computador ficam sempre visíveis mesmo com ficha técnica longa. */}
        <div className="shrink-0 space-y-2 border-t border-slate-100 bg-white px-5 py-4">
          <a
            href={
              temLink
                ? `/ir/loja/${oferta.id}?para=produto&oferta=${oferta.offerId}`
                : `/ir/loja/${oferta.id}?para=site`
            }
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <ArrowUpRight className="h-4 w-4" />
            {temLink ? dict.seeInStore : dict.noLink}
          </a>
          <div className="flex gap-2">
            {oferta.phone && (
              <a
                href={`/ir/loja/${oferta.id}?para=whatsapp`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <MessageCircle className="h-4 w-4" />
                {dict.whatsapp}
              </a>
            )}
            {/* Link do next-intl: escrever "/pt-BR/..." na mao jogaria quem
                navega em espanhol ou ingles para o site em portugues. */}
            <Link
              href={`/loja/${oferta.slug}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              <Store className="h-4 w-4" />
              {dict.seeStore}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
