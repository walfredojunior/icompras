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

/** Os três endereços de uma mesma página, para o Google saber que são a mesma coisa. */
export function comIdiomas(caminho: string) {
  const limpo = caminho.startsWith("/") ? caminho : `/${caminho}`;
  return {
    url: `${SITE_URL}/pt-BR${limpo === "/" ? "" : limpo}`,
    alternates: {
      languages: Object.fromEntries(
        IDIOMAS.map((l) => [l, `${SITE_URL}/${l}${limpo === "/" ? "" : limpo}`]),
      ),
    },
  };
}
