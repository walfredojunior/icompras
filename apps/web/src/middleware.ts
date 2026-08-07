import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { idiomaPorPais, CABECALHO_PAIS } from "./i18n/porPais";

const intl = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // PRIMEIRA VISITA NO IDIOMA DO PAÍS DE ONDE ELA VEM.
  //
  // O next-intl escolhe o idioma nesta ordem: (1) o que está na URL,
  // (2) o cookie NEXT_LOCALE, (3) o idioma do navegador, (4) o padrão.
  //
  // Não dá para usar a opção `localeDetection: false` da biblioteca: ela
  // desliga o passo 2 JUNTO com o 3 — o site esqueceria o idioma escolhido,
  // que é justamente o que queremos manter.
  //
  // Então escondemos o cabeçalho do navegador (alguém com Windows em inglês
  // não deve ver o site em inglês sem querer) e, no lugar dele, oferecemos o
  // idioma do PAÍS, que a Cloudflare informa em todo pedido. Fica assim:
  //
  //   1º  idioma no endereço (/es/produto/...)  — sempre manda
  //   2º  o que a pessoa JÁ ESCOLHEU (cookie)   — trocar na mão vale para sempre
  //   3º  o país de onde ela vem                — o que muda aqui
  //   4º  português, o padrão
  //
  // ⚠ O 2º acima do 3º não é detalhe: um argentino que prefira português troca
  // uma vez e não é "corrigido" na visita seguinte. Sem essa ordem, o site
  // discutiria com o visitante toda vez que ele voltasse.
  //
  // Só a moldura muda — nome de produto vem da fonte e continua como veio.
  const headers = new Headers(request.headers);
  headers.delete("accept-language");

  // O truque: `accept-language` é justamente o passo 3 do next-intl. Em vez de
  // reimplementar a escolha inteira, entregamos a ele o idioma do país NESSE
  // campo. Quem tem cookie nem chega aqui — o passo 2 vem antes.
  const doPais = idiomaPorPais(
    request.headers.get(CABECALHO_PAIS),
    request.headers.get("user-agent"),
  );
  if (doPais) headers.set("accept-language", doPais);

  return intl(new NextRequest(request, { headers }));
}

export const config = {
  // Aplica i18n a tudo, exceto API, saídas contadas (/ir), assets internos e
  // arquivos com extensão. O /ir precisa ficar de fora: é um redirecionamento
  // sem idioma, e o filtro estava mandando /ir/loja/1 para /es/ir/loja/1.
  matcher: ["/((?!api|ir|_next|_vercel|.*\\..*).*)"],
};
