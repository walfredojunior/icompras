"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { MapPin, Star, ChevronLeft, ChevronRight } from "lucide-react";

// A TIRA DE RESTAURANTES NA HOME (22/08/2026, segunda versão).
//
// ⚠ A PRIMEIRA VERSÃO ERA ALTA DEMAIS. Era um cartaz de 375px de altura com UM
// restaurante por vez. Ele viu na tela e pediu: "muito grande, tinha que ser
// mais fino e dentro dele aparecer uns 3 de cada vez".
//
// 💡 A saída foi trocar a FORMA do cartão, não só encolher: em vez de foto
// grande com o nome por cima, um cartão DEITADO — foto pequena à esquerda,
// texto à direita. Passou de ~375px para ~88px de altura, e três cabem lado a
// lado sem apertar.
//
// ⚠ AJUSTE FINO depois de ele ver na tela: "gostei, mas podia ser um pouquinho
// maior". Foto de 64 para 80px, respiro de 8 para 12 e o nome um corpo acima.
// 💡 Crescer a FOTO, e não o quadro vazio: é ela que dá a sensação de tamanho, e
// foto de restaurante pequena demais vira borrão.
//
// ⚠⚠ E AÍ OS DOIS TAMANHOS SE SEPARARAM (22/08/2026). Ele testou de novo: "no
// celular ficou perfeito, mas no PC podia ser um pouco mais alto". Faz sentido:
// no celular o cartão ocupa a largura toda da tela e 104px já pesam; no
// computador ele divide a linha com outros dois e some perto dos produtos.
//
//   celular    foto 80px  · respiro 12 · ~104px de altura   (ele aprovou)
//   computador foto 112px · respiro 16 · ~144px de altura
//
// 💡 Nunca mais medir "o tamanho do cartão" como se fosse um só: o mesmo
// componente tem dois tamanhos certos, e quem decide cada um é a tela.
//
// ⚠ NO CELULAR NÃO CABEM TRÊS (95% dos acessos são de lá): a tira desliza com o
// dedo, mostrando um cartão e um pedaço do próximo — o pedaço é o que avisa que
// há mais para o lado. No computador, os três aparecem juntos e o grupo troca
// sozinho a cada 7 segundos.

const SEGUNDOS = 7;
const POR_VEZ = 3;

interface R {
  id: number;
  nome: string;
  cidade: string;
  tipo: string;
  foto_url: string | null;
  destaque: number;
}

export function CarrosselDeRestaurantes({
  restaurantes,
  verTodos,
}: {
  restaurantes: R[];
  verTodos: string;
}) {
  const [grupo, setGrupo] = useState(0);
  const [parado, setParado] = useState(false);

  const grupos = Math.max(1, Math.ceil(restaurantes.length / POR_VEZ));

  useEffect(() => {
    if (parado || grupos < 2) return;
    const t = setTimeout(() => setGrupo((g) => (g + 1) % grupos), SEGUNDOS * 1000);
    return () => clearTimeout(t);
  }, [grupo, parado, grupos]);

  if (!restaurantes.length) return null;

  // No computador troca de grupo; no celular a lista inteira fica na tira que
  // desliza — quem manda lá é o dedo, não o relógio.
  const doGrupo = restaurantes.slice(grupo * POR_VEZ, grupo * POR_VEZ + POR_VEZ);

  return (
    <div onMouseEnter={() => setParado(true)} onMouseLeave={() => setParado(false)}>
      {/* CELULAR: tira deslizante com todos. `snap` faz parar certinho em cada. */}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:hidden">
        {restaurantes.map((r) => (
          <div key={r.id} className="w-[86%] shrink-0 snap-start">
            <CartaoDeitado r={r} verTodos={verTodos} />
          </div>
        ))}
      </div>

      {/* COMPUTADOR: três de cada vez, trocando sozinho. */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
        {doGrupo.map((r) => (
          <CartaoDeitado key={r.id} r={r} verTodos={verTodos} />
        ))}
      </div>

      {grupos > 1 && (
        <div className="mt-2 hidden items-center justify-center gap-2 sm:flex">
          <button
            onClick={() => setGrupo((g) => (g - 1 + grupos) % grupos)}
            aria-label="anteriores"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-brand-navy"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: grupos }).map((_, n) => (
            <button
              key={n}
              onClick={() => setGrupo(n)}
              aria-label={`grupo ${n + 1}`}
              className={`h-2 w-2 rounded-full transition ${
                n === grupo ? "bg-brand-green" : "bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
          <button
            onClick={() => setGrupo((g) => (g + 1) % grupos)}
            aria-label="próximos"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-brand-navy"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * O cartão deitado: foto pequena à esquerda, texto à direita.
 *
 * ⚠ O CARTÃO INTEIRO LEVA PARA /onde-comer, e não para o Instagram do
 * restaurante. A pessoa não escolheu este — ele só calhou de estar na tela. E é
 * a página do guia que precisa da visita: é ela que o Google indexa e onde
 * ficam os três espaços de anúncio.
 */
function CartaoDeitado({ r, verTodos }: { r: R; verTodos: string }) {
  return (
    <Link
      href="/onde-comer"
      title={verTodos}
      className="group flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand-green sm:gap-4 sm:p-4"
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-28 sm:w-28">
        {r.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.foto_url}
            alt={r.nome}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xl font-bold text-slate-300">
            {r.nome.slice(0, 1).toUpperCase()}
          </div>
        )}
        {r.destaque === 1 && (
          <span className="absolute left-0.5 top-0.5 rounded-full bg-amber-400 p-0.5">
            <Star className="h-2.5 w-2.5 text-amber-950" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.95rem] font-semibold text-slate-800 sm:text-base">{r.nome}</p>
        <p className="truncate text-xs text-slate-500 sm:text-sm">{r.tipo}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{r.cidade}</span>
        </p>
      </div>
    </Link>
  );
}
