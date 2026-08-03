import { routing } from "@/i18n/routing";

// Para onde vai o clique num banner.
//
// Este arquivo é PROPOSITALMENTE puro (não importa o banco): ele roda nos dois
// lados — no carrossel, que é componente de navegador, e na rota /ir/banner,
// que é servidor. Ter a regra escrita uma vez só é o que impede o link exibido
// e o link seguido de discordarem.

export type DestinoTipo = "auto" | "busca" | "marca" | "loja" | "link" | "nenhum";

export const TIPOS_DE_DESTINO: DestinoTipo[] = ["busca", "marca", "loja", "link", "nenhum"];

// O que a regra precisa saber de um banner. Menos que a linha inteira da
// tabela, de propósito.
export interface BannerParaDestino {
  link_url?: string | null;
  destino_tipo?: string | null;
  busca?: string | null;
  store_slug?: string | null;
}

export interface Destino {
  /** Endereço pronto. Interno já vem com o idioma na frente. */
  href: string;
  /** Sai do iCompras: abre em aba nova e leva rel de segurança. */
  externo: boolean;
}

// Nosso próprio domínio. Um banner pode ter sido cadastrado com o endereço
// completo (https://icompras.com.py/...) em vez do caminho — continua sendo
// link interno e não deve abrir aba nova.
const NOSSO_DOMINIO = "icompras.com.py";

export function idiomaValido(loc: string | null | undefined): string {
  return loc && (routing.locales as readonly string[]).includes(loc) ? loc : routing.defaultLocale;
}

// Tira o "/es" ou "/pt-BR" do começo do caminho.
//
// Os banners internos foram cadastrados com o idioma fixo (/es/categorias/...),
// então um visitante brasileiro clicava e caía na versão em espanhol. Tirando o
// prefixo aqui e pondo o de quem está navegando, os banners antigos ficam
// certos sem precisar reeditar nenhum.
function semPrefixoDeIdioma(caminho: string): string {
  const m = /^\/([^/?#]+)(.*)$/.exec(caminho);
  if (m && (routing.locales as readonly string[]).includes(m[1])) {
    return m[2] || "/";
  }
  return caminho.startsWith("/") ? caminho : `/${caminho}`;
}

// Decide se um endereço escrito à mão leva para fora do site.
//
// A conta sai só do texto, sem olhar `window`: assim o servidor e o navegador
// chegam ao mesmo resultado e a tela não pisca ao carregar.
function classificarLink(url: string, locale: string): Destino {
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      if (u.hostname.replace(/^www\./, "") === NOSSO_DOMINIO) {
        return { externo: false, href: interno(u.pathname + u.search + u.hash, locale) };
      }
    } catch {
      /* endereço torto: trata como externo, que é o caso conservador */
    }
    return { externo: true, href: url };
  }
  // mailto:, tel:, whatsapp: e afins também saem do site.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return { externo: true, href: url };
  return { externo: false, href: interno(url, locale) };
}

function interno(caminho: string, locale: string): string {
  return `/${locale}${semPrefixoDeIdioma(caminho)}`;
}

// A busca aberta por um banner leva `de=banner`.
//
// Sem essa marca, cada clique entraria na estatística como se alguém tivesse
// DIGITADO aquele termo — e é justamente essa estatística que usamos para achar
// buraco de catálogo ("termo muito buscado com zero resultado"). Um banner
// popular inventaria uma demanda que não existe.
export function urlDaBusca(
  locale: string,
  campo: "q" | "brand",
  valor: string,
  deBanner = true,
): string {
  const p = new URLSearchParams();
  p.set(campo, valor);
  if (deBanner) p.set("de", "banner");
  return `/${locale}/search?${p.toString()}`;
}

export function destinoDoBanner(b: BannerParaDestino, locale: string): Destino | null {
  const loc = idiomaValido(locale);
  const termo = (b.busca ?? "").trim();
  const link = (b.link_url ?? "").trim();

  switch ((b.destino_tipo ?? "auto") as DestinoTipo) {
    case "busca":
      return termo ? { href: urlDaBusca(loc, "q", termo), externo: false } : null;

    case "marca":
      return termo ? { href: urlDaBusca(loc, "brand", termo), externo: false } : null;

    case "loja":
      return b.store_slug ? { href: `/${loc}/loja/${b.store_slug}`, externo: false } : null;

    case "link":
      return link ? classificarLink(link, loc) : null;

    case "nenhum":
      return null;

    // 'auto' é o modo dos banners cadastrados antes desta tela existir: o
    // destino era adivinhado na ordem link → loja → nada. Fica preservado para
    // que nenhum banner antigo mude de comportamento sozinho.
    default:
      if (link) return classificarLink(link, loc);
      if (b.store_slug) return { href: `/${loc}/loja/${b.store_slug}`, externo: false };
      return null;
  }
}

// Arruma o que veio do formulário antes de gravar.
//
// Guardar só o que o tipo escolhido usa evita a pior classe de bug desta tela:
// um campo esquecido de uma escolha anterior (um link antigo, um termo antigo)
// ressuscitando o destino errado depois. A loja NÃO é limpa — ela também serve
// de etiqueta do anunciante, e um banner pago da Nissei pode muito bem abrir
// uma busca.
export function normalizarDestino(e: {
  destino_tipo?: string | null;
  busca?: string | null;
  link_url?: string | null;
}): { destino_tipo: DestinoTipo; busca: string | null; link_url: string | null } {
  const termo = (e.busca ?? "").trim().slice(0, 200) || null;
  const link = (e.link_url ?? "").trim().slice(0, 600) || null;

  let tipo = (e.destino_tipo ?? "") as DestinoTipo;
  if (!TIPOS_DE_DESTINO.includes(tipo)) {
    // Sem escolha explícita (ou escolha inválida), deduz pelo que veio
    // preenchido em vez de gravar 'auto' — banner novo nasce sempre com um
    // destino que dá para ler na tela.
    tipo = link ? "link" : "nenhum";
  }

  return {
    destino_tipo: tipo,
    busca: tipo === "busca" || tipo === "marca" ? termo : null,
    link_url: tipo === "link" ? link : null,
  };
}

// O tipo que um banner antigo (modo 'auto') teria se fosse cadastrado hoje.
// Usado ao abrir a edição: a caixa já aparece na opção certa, e salvar converte
// o banner para o modo explícito.
export function tipoEquivalente(b: BannerParaDestino): DestinoTipo {
  const t = (b.destino_tipo ?? "auto") as DestinoTipo;
  if (t !== "auto") return t;
  if ((b.link_url ?? "").trim()) return "link";
  if (b.store_slug) return "loja";
  return "nenhum";
}
