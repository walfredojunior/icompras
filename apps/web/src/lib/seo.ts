import type { Metadata } from "next";

// Endereço público do site, usado nos endereços absolutos do mapa e do
// robots.txt. Mapa de site com endereço relativo o Google simplesmente ignora.
export const SITE_URL = (process.env.SITE_URL ?? "https://icompras.com.py").replace(/\/$/, "");

// Quantos produtos por arquivo de mapa.
//
// O limite do Google é 50.000 endereços por arquivo. Uso 10.000 de propósito:
// com 41 mil produtos e crescendo para ~120 mil, arquivo menor é gerado mais
// rápido, cabe na memória sem sustos e o Google reprocessa só o pedaço que
// mudou em vez do arquivo inteiro.
export const PRODUTOS_POR_MAPA = 10000;

export const IDIOMAS = ["pt-BR", "es", "en"] as const;

/** Idioma de referência quando o buscador não sabe de onde vem a pessoa. */
export const IDIOMA_PADRAO = "pt-BR";

/** Nome que fecha todo titulo. */
export const MARCA = "iCompras";

export type Idioma = (typeof IDIOMAS)[number];

function limpar(caminho: string) {
  const c = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return c === "/" ? "" : c.replace(/\/$/, "");
}

/** Endereço absoluto de uma página num idioma. */
export function enderecoDe(locale: string, caminho: string) {
  return `${SITE_URL}/${locale}${limpar(caminho)}`;
}

/** Os três endereços de uma mesma página, para o Google saber que são a mesma coisa. */
export function comIdiomas(caminho: string) {
  return {
    url: enderecoDe(IDIOMA_PADRAO, caminho),
    alternates: {
      languages: Object.fromEntries(IDIOMAS.map((l) => [l, enderecoDe(l, caminho)])),
    },
  };
}

// ---------------------------------------------------------------------------
// Título e descrição de cada página
// ---------------------------------------------------------------------------

// Até 08/08/2026 as 224 mil páginas do site se apresentavam ao Google com o
// MESMO título e a MESMA descrição — os do layout, que valem para o site
// inteiro. Para o buscador, 224 mil páginas iguais são 224 mil cópias: ele
// indexa uma, descarta o resto e marca as demais como "página alternativa com
// canonical adequada". Nenhuma quantidade de mapa de site resolve isso.
//
// Aqui fica a montagem, num lugar só, para que toda página pública tenha:
//   • título próprio, com o nome do produto/loja/categoria na frente;
//   • descrição própria;
//   • endereço canônico apontando para ela mesma;
//   • hreflang ligando as três versões de idioma (senão o espanhol e o inglês
//     viram cópias do português e somem do índice);
//   • cartão de compartilhamento (WhatsApp, Facebook) com foto.

/** Corta sem partir palavra no meio. */
export function cortar(texto: string, max: number) {
  const t = texto.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const pedaco = t.slice(0, max);
  const espaco = pedaco.lastIndexOf(" ");
  return `${(espaco > max * 0.6 ? pedaco.slice(0, espaco) : pedaco).replace(/[\s,.;:—-]+$/, "")}…`;
}

/** "US$ 1.299" — usado nas descrições. */
export function precoUsd(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return null;
  return `US$ ${Math.round(valor).toLocaleString("pt-BR")}`;
}

type Meta = {
  locale: string;
  /** Caminho SEM o idioma: "/produto/iphone-15" */
  caminho: string;
  /** Sem o " | iCompras" — quem acrescenta é o `paginaMeta`. */
  titulo: string;
  descricao: string;
  imagem?: string | null;
  /** false em páginas de conta, busca e administração. */
  indexar?: boolean;
};

/**
 * Monta o bloco de metadados de uma página.
 *
 * ⚠ O canônico aponta para a PRÓPRIA página no idioma dela, não para o
 * português. Apontar tudo para o português diria ao Google "as versões em
 * espanhol e inglês não existem" — e ele deixaria de indexá-las. O que liga as
 * três é o hreflang, não o canônico.
 */
export function paginaMeta({
  locale,
  caminho,
  titulo,
  descricao,
  imagem,
  indexar = true,
}: Meta): Metadata {
  const idiomas: Record<string, string> = Object.fromEntries(
    IDIOMAS.map((l) => [l, enderecoDe(l, caminho)]),
  );
  // Quem chega sem idioma definido (ou de um país que não listamos) cai no
  // português: é a maioria do público — brasileiro que compra no Paraguai.
  idiomas["x-default"] = enderecoDe(IDIOMA_PADRAO, caminho);

  const url = enderecoDe(locale, caminho);
  const fotos = imagem ? [{ url: imagem }] : undefined;
  const completo = `${titulo} | ${MARCA}`;

  return {
    // `absolute` monta o título inteiro aqui em vez de deixar o modelo do
    // layout completar. Motivo: o modelo NÃO vale para a página que fica na
    // mesma pasta do layout — a home ficaria sem o "| iCompras" enquanto todas
    // as outras teriam. Montando aqui, as três coisas (aba do navegador,
    // resultado do Google e cartão do WhatsApp) saem sempre iguais.
    title: { absolute: completo },
    description: descricao,
    alternates: { canonical: url, languages: idiomas },
    openGraph: {
      title: completo,
      description: descricao,
      url,
      siteName: MARCA,
      locale,
      type: "website" as const,
      images: fotos,
    },
    twitter: {
      card: (fotos ? "summary_large_image" : "summary") as "summary_large_image" | "summary",
      title: completo,
      description: descricao,
      images: fotos,
    },
    ...(indexar ? {} : { robots: { index: false, follow: true } }),
  };
}

// ---------------------------------------------------------------------------
// Dados estruturados (JSON-LD)
// ---------------------------------------------------------------------------

/**
 * Serializa para dentro de um <script type="application/ld+json">.
 *
 * ⚠ Escapa todo sinal de "menor que". Sem isso, um produto cujo nome trouxesse
 * uma tag de fechamento — e o nome vem de fora, do coletor — fecharia o script
 * e o resto viraria HTML da página. É o buraco clássico de JSON dentro de
 * script.
 */
export function jsonLd(dados: unknown) {
  return JSON.stringify(dados).replace(/</g, "\\u003c");
}
