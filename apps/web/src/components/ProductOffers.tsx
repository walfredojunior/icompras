"use client";

import { useState, useMemo } from "react";
import { MessageCircle, ArrowUpRight, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { fromUsd, fmt } from "@/lib/money";
import type { Rates } from "@/lib/rates";
import type { ProductStore } from "@/lib/products";

export interface OfferDict {
  relevance: string;
  priceAsc: string;
  priceDesc: string;
  productAz: string;
  productZa: string;
  store: string;
  newest: string;
  cheapest: string;
  sortBy: string;
  seeStore: string;
  code: string;
}

// Lista de lojas que vendem o produto.
//
// A versão anterior repetia, em CADA oferta, a foto grande e o nome do
// produto — os mesmos 45 vezes — mais o logo da loja numa caixa enorme:
// 497px por oferta, 33 telas de rolagem no celular.
//
// Aqui cada linha mostra só o que muda de uma oferta para outra: QUEM vende,
// POR QUANTO e como chegar lá. A foto e o nome ficam uma única vez, no topo
// da página.
export function ProductOffers({
  productName,
  productImage,
  stores,
  rates,
  locale,
  dict,
}: {
  productName: string;
  productImage: string | null;
  stores: ProductStore[];
  rates: Rates;
  locale: string;
  dict: OfferDict;
}) {
  const [sort, setSort] = useState("relevancia");

  const sorted = useMemo(() => {
    const arr = [...stores];
    switch (sort) {
      case "menor":
        arr.sort((a, b) => (a.priceUsd ?? Infinity) - (b.priceUsd ?? Infinity));
        break;
      case "maior":
        arr.sort((a, b) => (b.priceUsd ?? -Infinity) - (a.priceUsd ?? -Infinity));
        break;
      case "az":
      case "loja":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        arr.sort((a, b) => b.name.localeCompare(a.name));
        break;
      default:
        break; // relevância / mais novos = ordem original
    }
    return arr;
  }, [stores, sort]);

  // O mais barato entre os que têm preço — marcado com a estrela.
  const menorPreco = useMemo(() => {
    const comPreco = stores.filter((s) => s.priceUsd != null).map((s) => s.priceUsd as number);
    return comPreco.length ? Math.min(...comPreco) : null;
  }, [stores]);

  const fmtUsd = (v: number) => fmt(fromUsd(v, rates).usd, "USD", locale);
  const fmtBrl = (v: number) => fmt(fromUsd(v, rates).brl, "BRL", locale);
  const fmtPyg = (v: number) => fmt(fromUsd(v, rates).pyg, "PYG", locale);

  const acao =
    "flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-brand-green hover:text-brand-green-dark";

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="text-sm text-slate-500">{dict.sortBy}:</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="relevancia">{dict.relevance}</option>
          <option value="menor">{dict.priceAsc}</option>
          <option value="maior">{dict.priceDesc}</option>
          <option value="az">{dict.productAz}</option>
          <option value="za">{dict.productZa}</option>
          <option value="loja">{dict.store}</option>
          <option value="novos">{dict.newest}</option>
        </select>
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {sorted.map((s) => {
          const barato = menorPreco != null && s.priceUsd === menorPreco;
          return (
            <li key={s.slug} className={`p-3 sm:p-4 ${barato ? "bg-brand-green-light/40" : ""}`}>
              <div className="flex items-start gap-3">
                {/* Foto DAQUELA oferta (cada loja anuncia uma variação —
                    cor, modelo). Sem ela, cai na foto do produto. */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white sm:h-20 sm:w-20">
                  {s.offerImage || productImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.offerImage ?? productImage ?? ""}
                      alt=""
                      loading="lazy"
                      // A foto da oferta vem do servidor da fonte e às vezes
                      // some. Nesse caso cai na foto do produto, e só depois
                      // na inicial da loja — nunca fica o ícone quebrado.
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (productImage && img.src !== productImage) img.src = productImage;
                        else img.style.display = "none";
                      }}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-slate-300">{s.name.slice(0, 1)}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Descrição da oferta, do jeito que a loja anuncia */}
                  <p className="line-clamp-2 text-sm text-slate-800">{s.offerTitle ?? productName}</p>
                  {s.offerCode && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {dict.code}: {s.offerCode}
                    </p>
                  )}
                  {/* Preço e selo na mesma linha, com as moedas
                      secundárias lado a lado — assim a linha inteira fica
                      na altura da do comprasparaguai. */}
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    {s.priceUsd != null ? (
                      <>
                        <span className="text-base font-bold text-brand-green-dark">
                          {fmtUsd(s.priceUsd)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {fmtBrl(s.priceUsd)} · {fmtPyg(s.priceUsd)}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                    {barato && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-green-dark">
                        <Star className="h-3 w-3 fill-current" />
                        {dict.cheapest}
                      </span>
                    )}
                  </div>
                </div>

                {/* Logo da loja, à direita — igual ao comprasparaguai */}
                <Link href={`/loja/${s.slug}`} className="shrink-0" title={s.name}>
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt={s.name} className="h-10 w-20 object-contain sm:h-12 sm:w-24" />
                  ) : (
                    <span className="flex h-10 w-20 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-500 sm:h-12 sm:w-24">
                      {s.name.slice(0, 12)}
                    </span>
                  )}
                </Link>
              </div>

              {/* Ações */}
              <div className="mt-2 flex flex-wrap items-center gap-2 pl-[4.75rem] sm:pl-[5.75rem]">
                {s.phone && (
                  <a href={`/ir/loja/${s.id}?para=whatsapp`} target="_blank" rel="noopener noreferrer" className={acao}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}
                <Link href={`/loja/${s.slug}`} className={acao}>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {dict.seeStore}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
