"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { destinoDoBanner, type BannerParaDestino } from "@/lib/bannerDestino";

interface B extends BannerParaDestino {
  id: number;
  image_url: string;
  title: string | null;
  is_paid?: number;
}

// Tempo de cada banner na tela.
//
// Eram 5 segundos e o dono do site reclamou que não dava tempo de ler — banner
// costuma ter uma frase inteira, e 5s é o tempo de uma imagem sem texto.
const SEGUNDOS_POR_BANNER = 8;

/**
 * A proporção do quadro do banner.
 *
 * ⚠ NÃO É A MESMA EM TODO LUGAR (21/08/2026). O banner do topo é a entrada da
 * página e pode ser alto. Os que ficam ENTRE os produtos são interrupções: se
 * tiverem a mesma altura, empurram a lista para baixo e atrapalham justamente
 * quem está comparando preços — que é o que a pessoa veio fazer aqui.
 *
 * 💡 Como 95% dos acessos são de celular, a conta que importa é a de lá. Numa
 * tela de 390px (≈358 úteis):
 *     2,3:1 (o do topo) → ~156px de altura
 *     6:1               →  ~60px
 *     4:1               →  ~90px
 */
export function BannerCarousel({
  banners,
  lazy = false,
  proporcao = "858/375",
}: {
  banners: B[];
  lazy?: boolean;
  proporcao?: string;
}) {
  const [i, setI] = useState(0);
  const [parado, setParado] = useState(false);
  // O clique no banner é o ÚNICO que o esqueleto de página não cobre: ele passa
  // pela rota que conta o clique antes de seguir, então é uma navegação inteira
  // do navegador e não uma troca de tela do Next. Sem retorno visual, ficava a
  // sensação de que o toque não pegou. Este estado acende assim que a pessoa
  // clica, antes de a viagem começar.
  const [indo, setIndo] = useState(false);
  const locale = useLocale();

  // `i` entra nas dependências de propósito: assim o relógio reinicia sempre
  // que o banner muda — inclusive quando a troca veio de um clique nas
  // bolinhas. Sem isso, escolher um banner podia mostrá-lo por meio segundo
  // antes de a contagem antiga virar.
  useEffect(() => {
    if (banners.length <= 1 || parado) return;
    const t = setTimeout(() => setI((x) => (x + 1) % banners.length), SEGUNDOS_POR_BANNER * 1000);
    return () => clearTimeout(t);
  }, [banners.length, parado, i]);

  if (!banners.length) return null;
  const b = banners[i % banners.length];
  // ⚠ CARREGAMENTO PREGUIÇOSO NOS ESPAÇOS DE BAIXO (21/08/2026).
  //
  // **95% de quem usa o iCompras está no celular** (58.676 acessos contra 2.751
  // no computador, medido no registro do nginx). Com três espaços de banner por
  // página e imagens de até 156 KB, seriam ~300 KB de publicidade baixados na
  // abertura, em internet móvel, antes de a pessoa ver qualquer produto.
  //
  // 💡 Só o banner do topo carrega de imediato — é o único visível sem rolar.
  // Os de meio e fim esperam a pessoa chegar perto; se ela não rolar, nunca são
  // baixados. `decoding="async"` evita que a imagem trave a montagem da página.
  // eslint-disable-next-line @next/next/no-img-element
  const img = (
    <img
      src={b.image_url}
      alt={b.title ?? ""}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      className="h-full w-full object-cover"
    />
  );

  // Para onde o banner leva. A regra inteira mora em lib/bannerDestino.ts,
  // compartilhada com a rota /ir/banner — o link mostrado e o link seguido têm
  // que ser o mesmo.
  const destino = destinoDoBanner(b, locale);

  let conteudo = img;
  if (destino) {
    // O href aponta para a passagem que CONTA o clique; o destino de verdade é
    // resolvido lá, a partir do banco. Vale também para os links internos: é o
    // único jeito de saber quantos cliques cada banner recebeu.
    const href = `/ir/banner/${b.id}?loc=${encodeURIComponent(locale)}`;
    // noopener/noreferrer: sem isso a página aberta ganha um canal de volta
    // para esta aba e pode trocá-la por uma cópia falsa do iCompras pedindo
    // senha (o golpe do "tabnabbing"). Navegador novo já protege sozinho; a
    // palavra aqui cobre os antigos e não custa nada.
    //
    // sponsored: banner PAGO precisa ser declarado como publicidade. Sem isso
    // o Google entende que o site está vendendo a própria reputação, e é
    // motivo de penalização — o oposto do que interessa aqui.
    const rel = destino.externo
      ? b.is_paid
        ? "noopener noreferrer sponsored nofollow"
        : "noopener noreferrer"
      : undefined;
    conteudo = (
      <a
        href={href}
        target={destino.externo ? "_blank" : undefined}
        rel={rel}
        // Aba nova não tira a pessoa daqui, então não há por que "acender".
        onClick={() => !destino.externo && setIndo(true)}
        className="group relative block h-full w-full"
      >
        {img}
        {indo && (
          <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/45 backdrop-blur-[1px]">
            <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
          </span>
        )}
      </a>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Passar o mouse (ou o dedo) segura o banner: quem parou para ler não
          quer que a imagem troque no meio da frase. */}
      {/* Só no mouse. No celular não dá para "sair de cima": um toque deixaria
          o carrossel parado para sempre, e ali o que resolve a leitura é o
          tempo maior. */}
      <div
        onMouseEnter={() => setParado(true)}
        onMouseLeave={() => setParado(false)}
        style={{ aspectRatio: proporcao.replace("/", " / ") }}
        className="relative w-full overflow-hidden rounded-2xl bg-slate-100"
      >
        {conteudo}
      </div>
      {banners.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {banners.map((_, x) => (
            <button
              key={x}
              onClick={() => setI(x)}
              aria-label={`Banner ${x + 1}`}
              className={`h-2 w-2 rounded-full ${x === i ? "bg-brand-green" : "bg-slate-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
