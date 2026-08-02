"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

interface B {
  id: number;
  image_url: string;
  link_url: string | null;
  title: string | null;
  is_paid?: number;
  /** Loja ligada ao banner, quando existe aqui no iCompras. */
  store_slug?: string | null;
}

// Tempo de cada banner na tela.
//
// Eram 5 segundos e o dono do site reclamou que não dava tempo de ler — banner
// costuma ter uma frase inteira, e 5s é o tempo de uma imagem sem texto.
const SEGUNDOS_POR_BANNER = 8;

// Nosso próprio domínio. Um banner pode ter sido cadastrado com o endereço
// completo (https://icompras.com.py/...) em vez do caminho — continua sendo
// link interno e não deve abrir aba nova.
const NOSSO_DOMINIO = "icompras.com.py";

// Decide se o banner leva para fora do site.
//
// Por que a distinção importa: abrir uma página do PRÓPRIO site em aba nova
// deixa a pessoa com duas abas do iCompras e a sensação de ter perdido a
// navegação ao fechar uma. Aba nova só faz sentido quando o clique leva embora.
//
// A conta sai só do texto do endereço, sem olhar `window`: assim o servidor e o
// navegador chegam ao mesmo resultado e a tela não pisca ao carregar.
function classificar(url: string): { externo: boolean; href: string } {
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      if (u.hostname.replace(/^www\./, "") === NOSSO_DOMINIO) {
        return { externo: false, href: semPrefixoDeIdioma(u.pathname + u.search + u.hash) };
      }
    } catch {
      /* endereço torto: trata como externo, que é o caso conservador */
    }
    return { externo: true, href: url };
  }
  // mailto:, tel:, whatsapp: e afins também saem do site.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return { externo: true, href: url };
  return { externo: false, href: semPrefixoDeIdioma(url) };
}

// Tira o "/es" ou "/pt-BR" do começo do caminho.
//
// Os banners internos foram cadastrados com o idioma fixo (/es/categorias/...),
// então um visitante brasileiro clicava e caía na versão em espanhol. Tirando o
// prefixo aqui, o <Link> põe o idioma de quem está navegando — e isso conserta
// os banners antigos sem precisar reeditar nenhum.
function semPrefixoDeIdioma(caminho: string): string {
  const m = /^\/([^/?#]+)(.*)$/.exec(caminho);
  if (m && (routing.locales as readonly string[]).includes(m[1])) {
    return m[2] || "/";
  }
  return caminho.startsWith("/") ? caminho : `/${caminho}`;
}

export function BannerCarousel({ banners }: { banners: B[] }) {
  const [i, setI] = useState(0);
  const [parado, setParado] = useState(false);

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

  // Para onde o banner leva.
  //
  // Regra pedida pelo dono do site: se o banner não tem link próprio mas a loja
  // existe aqui no iCompras, o clique vai para a página dela aqui dentro. E se
  // não houver nem link nem loja, o banner fica só como imagem, sem clique.
  const destino = b.link_url || (b.store_slug ? `/loja/${b.store_slug}` : null);

  let conteudo = img;
  if (destino) {
    const d = classificar(destino);
    if (d.externo) {
      // noopener/noreferrer: sem isso a página aberta ganha um canal de volta
      // para esta aba e pode trocá-la por uma cópia falsa do iCompras pedindo
      // senha (o golpe do "tabnabbing"). Navegador novo já protege sozinho; a
      // palavra aqui cobre os antigos e não custa nada.
      //
      // sponsored: banner PAGO precisa ser declarado como publicidade. Sem
      // isso o Google entende que o site está vendendo a própria reputação, e
      // é motivo de penalização — o oposto do que interessa aqui.
      const rel = b.is_paid ? "noopener noreferrer sponsored nofollow" : "noopener noreferrer";
      conteudo = (
        <a href={d.href} target="_blank" rel={rel} className="block h-full w-full">
          {img}
        </a>
      );
    } else {
      conteudo = (
        <Link href={d.href} className="block h-full w-full">
          {img}
        </Link>
      );
    }
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
