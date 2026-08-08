// Entende os vários formatos de endereço do YouTube.
//
// Existe para o vídeo flutuante da home (a câmera ao vivo da Ponte da
// Amizade). O dono cola o endereço na tela de Banners como ele o copiou do
// navegador — e o YouTube tem meia dúzia de formatos diferentes para a mesma
// coisa. Traduzir isso é trabalho do código, não dele.

export interface VideoYoutube {
  /** Endereço para pôr no iframe quando a pessoa clicar. */
  embed: string;
  /** Foto de capa, quando dá para saber. Null em canal ao vivo. */
  capa: string | null;
  /** Transmissão de canal (não um vídeo específico). */
  aoVivoDeCanal: boolean;
}

/**
 * Transforma qualquer endereço do YouTube no que precisamos.
 * Devolve null se não for YouTube — aí o vídeo simplesmente não aparece.
 *
 * ⚠ Dois casos bem diferentes:
 *  • VÍDEO (tem um id de 11 caracteres) — dá para mostrar a capa sem carregar
 *    nada do YouTube, e num canal ao vivo essa capa é um quadro RECENTE da
 *    transmissão. Para uma câmera de ponte, isso é informação de verdade: a
 *    pessoa vê o movimento sem nem clicar.
 *  • CANAL (id que começa com UC) — o YouTube embute "a transmissão atual do
 *    canal", mas não fornece capa. Aí vale a imagem que o dono subir.
 */
export function lerYoutube(url: string | null | undefined): VideoYoutube | null {
  if (!url) return null;
  const limpo = url.trim();

  // .../embed/live_stream?channel=UC... e .../channel/UC.../live
  const canal = limpo.match(/(?:channel=|\/channel\/)(UC[\w-]{20,})/);
  if (canal) {
    return {
      embed: `https://www.youtube-nocookie.com/embed/live_stream?channel=${canal[1]}`,
      capa: null,
      aoVivoDeCanal: true,
    };
  }

  // watch?v=ID · youtu.be/ID · /live/ID · /embed/ID · /shorts/ID
  const vid =
    limpo.match(/[?&]v=([\w-]{11})/) ??
    limpo.match(/youtu\.be\/([\w-]{11})/) ??
    limpo.match(/\/(?:live|embed|shorts)\/([\w-]{11})/);
  if (vid) {
    const id = vid[1];
    return {
      // `nocookie` de propósito: não planta cookie de anúncio em quem só passou
      // pela home. E `rel=0` para não sugerir vídeo de concorrente no fim.
      embed: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&rel=0`,
      capa: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      aoVivoDeCanal: false,
    };
  }

  // Endereço de canal por apelido (youtube.com/@canal/live) não tem id em
  // lugar nenhum — só uma chamada à API do YouTube resolveria, e isso exigiria
  // chave. Melhor devolver null e explicar na tela do que fingir que deu.
  return null;
}
