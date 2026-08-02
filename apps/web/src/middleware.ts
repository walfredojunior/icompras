import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  // PRIMEIRA VISITA SEMPRE EM PORTUGUÊS.
  //
  // O next-intl escolhe o idioma nesta ordem: (1) o que está na URL,
  // (2) o cookie NEXT_LOCALE, (3) o idioma do navegador, (4) o padrão.
  //
  // Não dá para usar a opção `localeDetection: false` da biblioteca: ela
  // desliga o passo 2 JUNTO com o 3 — o site esqueceria o idioma escolhido,
  // que é justamente o que queremos manter.
  //
  // Então escondemos apenas o cabeçalho do navegador. Resultado:
  //   • quem já escolheu  → volta no idioma dele (cookie)
  //   • quem nunca entrou → cai no padrão, português
  const headers = new Headers(request.headers);
  headers.delete("accept-language");
  return intl(new NextRequest(request, { headers }));
}

export const config = {
  // Aplica i18n a tudo, exceto API, saídas contadas (/ir), assets internos e
  // arquivos com extensão. O /ir precisa ficar de fora: é um redirecionamento
  // sem idioma, e o filtro estava mandando /ir/loja/1 para /es/ir/loja/1.
  matcher: ["/((?!api|ir|_next|_vercel|.*\\..*).*)"],
};
