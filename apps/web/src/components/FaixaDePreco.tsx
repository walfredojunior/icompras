"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { buildHref } from "@/lib/urlFiltros";

// BARRA DE PREÇO COM DUAS BOLINHAS
//
// São dois controles deslizantes NATIVOS do HTML, um por cima do outro — sem
// biblioteca. O detalhe que faz funcionar: os controles ignoram o clique
// (`pointer-events-none`) e só as bolinhas respondem (`pointer-events-auto` no
// pseudo-elemento do polegar). Sem isso o de cima cobriria o de baixo e uma das
// bolinhas ficaria impossível de pegar.
//
// ⚠ A ESCALA NÃO É LINEAR, e isso não é enfeite. Medido em 05/08/2026: metade
// do catálogo custa até US$ 21,84 e o produto mais caro custa US$ 35.360. Numa
// barra linear, METADE dos produtos caberia nos primeiros 0,06% do trilho — um
// fio de cabelo de arrasto pularia de US$ 5 para US$ 400. Com a escala
// logarítmica a bolinha anda onde existem produtos.
//
// Tudo em DÓLAR (decisão do dono, 05/08/2026): é a moeda em que o filtro
// realmente opera. Real e guarani seguem como informação extra nos cartões.

const PASSOS = 1000; // resolução interna do trilho

/** Posição (0..PASSOS) → dólares. */
function paraValor(pos: number, min: number, max: number): number {
  if (max <= min) return min;
  const a = Math.log(min + 1);
  const b = Math.log(max + 1);
  const v = Math.exp(a + ((b - a) * pos) / PASSOS) - 1;
  // Arredonda de um jeito que o número mostrado não fique feio: centavos só
  // enquanto o valor é pequeno.
  if (v < 10) return Math.round(v * 10) / 10;
  if (v < 100) return Math.round(v);
  return Math.round(v / 5) * 5;
}

/** Dólares → posição (0..PASSOS). */
function paraPosicao(valor: number, min: number, max: number): number {
  if (max <= min) return 0;
  const a = Math.log(min + 1);
  const b = Math.log(max + 1);
  const p = ((Math.log(Math.max(min, Math.min(max, valor)) + 1) - a) / (b - a)) * PASSOS;
  return Math.round(Math.max(0, Math.min(PASSOS, p)));
}

const dinheiro = (v: number, locale: string) =>
  `US$ ${v.toLocaleString(locale, { maximumFractionDigits: v < 10 ? 1 : 0 })}`;

export function FaixaDePreco({
  faixa,
  params,
  locale,
  rotulo,
  aoSoltar,
}: {
  faixa: { min: number; max: number };
  params: Record<string, string | undefined>;
  locale: string;
  rotulo: string;
  /**
   * Quando informado, a barra NÃO navega sozinha — apenas devolve os valores.
   * É o caso do painel de filtros do celular, que tem o próprio botão
   * "aplicar" e junta preço e marcas numa navegação só.
   */
  aoSoltar?: (de: string | null, ate: string | null) => void;
}) {
  const router = useRouter();
  const { min, max } = faixa;

  // Valores atuais: o que está no endereço, ou as pontas da faixa.
  const inicial = useMemo(() => {
    const de = Number(params.min);
    const ate = Number(params.max);
    return {
      a: Number.isFinite(de) && params.min ? paraPosicao(de, min, max) : 0,
      b: Number.isFinite(ate) && params.max ? paraPosicao(ate, min, max) : PASSOS,
    };
  }, [params.min, params.max, min, max]);

  const [a, setA] = useState(inicial.a);
  const [b, setB] = useState(inicial.b);

  // Voltar/avançar no navegador, ou trocar de categoria, muda os parâmetros —
  // as bolinhas têm que acompanhar.
  useEffect(() => {
    setA(inicial.a);
    setB(inicial.b);
  }, [inicial.a, inicial.b]);

  const de = paraValor(Math.min(a, b), min, max);
  const ate = paraValor(Math.max(a, b), min, max);
  const esq = (Math.min(a, b) / PASSOS) * 100;
  const dir = 100 - (Math.max(a, b) / PASSOS) * 100;

  // Busca só AO SOLTAR a bolinha. Durante o arrasto seriam dezenas de buscas
  // por gesto, e o resultado ficaria pulando debaixo do dedo.
  function aplicar() {
    // Bolinha encostada na ponta = "sem limite": não vai para o endereço, para
    // o link não ficar sujo nem prometer um filtro que não filtra nada.
    const novoMin = Math.min(a, b) === 0 ? null : String(de);
    const novoMax = Math.max(a, b) === PASSOS ? null : String(ate);
    if (aoSoltar) aoSoltar(novoMin, novoMax);
    else router.push(buildHref(params, { min: novoMin, max: novoMax }));
  }

  const trilho =
    "pointer-events-none absolute h-1 w-full appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 " +
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
    "[&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-brand-green " +
    "[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow " +
    "[&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 " +
    "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] " +
    "[&::-moz-range-thumb]:border-brand-green [&::-moz-range-thumb]:bg-white";

  return (
    <div className="mt-4">
      <span className="text-xs font-medium text-slate-600">{rotulo}</span>

      <div className="mt-1 flex items-baseline justify-between text-xs font-semibold text-brand-navy">
        <span>{dinheiro(de, locale)}</span>
        <span>{dinheiro(ate, locale)}</span>
      </div>

      <div className="relative mt-2 flex h-5 items-center">
        <div className="absolute h-1 w-full rounded-full bg-slate-200" />
        <div className="absolute h-1 rounded-full bg-brand-green" style={{ left: `${esq}%`, right: `${dir}%` }} />
        <input
          type="range"
          min={0}
          max={PASSOS}
          value={a}
          aria-label={`${rotulo} — mínimo`}
          onChange={(e) => setA(Number(e.target.value))}
          onPointerUp={aplicar}
          onKeyUp={aplicar}
          className={trilho}
        />
        <input
          type="range"
          min={0}
          max={PASSOS}
          value={b}
          aria-label={`${rotulo} — máximo`}
          onChange={(e) => setB(Number(e.target.value))}
          onPointerUp={aplicar}
          onKeyUp={aplicar}
          className={trilho}
        />
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{dinheiro(min, locale)}</span>
        <span>{dinheiro(max, locale)}</span>
      </div>
    </div>
  );
}
