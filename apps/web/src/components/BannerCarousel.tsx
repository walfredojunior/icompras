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

export function BannerCarousel({ banners }: { banners: B[] }) {
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
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={b.image_url} alt={b.title ?? ""} className="h-full w-full object-cover" />;

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
        className="relative aspect-[858/375] w-full overflow-hidden rounded-2xl bg-slate-100"
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
