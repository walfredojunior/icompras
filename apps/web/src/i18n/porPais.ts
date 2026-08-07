// QUAL IDIOMA MOSTRAR PARA QUEM CHEGA DE CADA PAÍS.
//
// Pedido do dono em 07/08/2026: "se o acesso for do Brasil que seja em
// português, se for da Argentina e Paraguai espanhol, se for da América Latina
// espanhol, e se for fora disso em inglês".
//
// ⚠ Isto vale só para a MOLDURA do site — menus, botões, categorias. Nome de
// produto vem da fonte e continua como veio; não há tradução para inventar ali.
//
// A lista é escrita à mão em vez de uma pergunta esperta do tipo "é América
// Latina?": assim o dono lê, entende e ajusta um país sozinho. Uma regra que só
// o autor consegue ler não serve para quem vai conviver com ela.

/** De onde vem o país: a Cloudflare põe este cabeçalho em todo pedido. */
export const CABECALHO_PAIS = "cf-ipcountry";

const PORTUGUES = new Set([
  "BR", // Brasil — o público principal
  "PT", // Portugal
  "AO", // Angola
  "MZ", // Moçambique
  "CV", // Cabo Verde
]);

const ESPANHOL = new Set([
  "PY", // Paraguai — onde ficam as lojas
  "AR", // Argentina
  "UY",
  "CL",
  "BO",
  "PE",
  "CO",
  "VE",
  "EC",
  "MX",
  "CR",
  "PA",
  "GT",
  "HN",
  "NI",
  "SV",
  "CU",
  "DO",
  "ES", // Espanha
]);

/**
 * ⚠ ROBÔ DE BUSCA VÊ SEMPRE PORTUGUÊS — e esta é a linha que mais protege o
 * negócio.
 *
 * O Google rastreia quase sempre de servidores nos ESTADOS UNIDOS, que pela
 * regra acima cairiam em inglês. Sem esta exceção, ele passaria a tratar o
 * iCompras como um site em inglês — enquanto quem precisa encontrá-lo é o
 * brasileiro. O idioma da vitrine é o que decide para quem o Google mostra.
 *
 * Não é disfarce: cada idioma tem endereço próprio (`/pt-BR/...`, `/es/...`) e
 * todos continuam acessíveis a qualquer um. O que se decide aqui é só a porta
 * de entrada de quem chega sem escolher.
 */
const ROBOS = /bot|crawler|spider|crawling|googlebot|bingbot|duckduckbot|baiduspider|yandex|slurp|facebookexternalhit|whatsapp|telegrambot/i;

export function idiomaPorPais(pais: string | null, userAgent: string | null): string | null {
  if (userAgent && ROBOS.test(userAgent)) return "pt-BR";
  if (!pais) return null; // sem informação: quem chama decide o padrão
  const p = pais.trim().toUpperCase();
  if (PORTUGUES.has(p)) return "pt-BR";
  if (ESPANHOL.has(p)) return "es";
  // `XX` e `T1` são o que a Cloudflare manda quando não sabe (rede Tor, por
  // exemplo). Tratar como "resto do mundo" é o certo: inglês.
  return "en";
}
