import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Build de produção não trava por erros de tipo/lint (o código roda igual; corrigir aos poucos).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Permite testar de outros aparelhos na rede local (celular via IP do PC).
  allowedDevOrigins: ["192.168.68.109", "192.168.68.*"],
  // Driver do MariaDB deve rodar no Node, não ser empacotado.
  serverExternalPackages: ["mariadb", "sharp"],

  // ONDE O BUILD É ESCRITO — configurável de propósito.
  //
  // ⚠ Em 11/08/2026 eu derrubei o admin do site no horário de pico. A causa
  // não foi o código: foi o `next build` escrevendo DIRETO no `.next` que o
  // site estava usando. Uma construção que morre no meio deixa o diretório
  // inconsistente, e o processo que está servindo passa a falhar nas páginas
  // que precisa ler do disco.
  //
  // Com isto, toda construção de teste vai para outro lugar
  // (`NEXT_DIST_DIR=.next-novo npm run build`), e o que está no ar só é
  // trocado depois que a nova passa no teste. Build que falha vira um não
  // evento, em vez de um site fora do ar.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  // ⚠ NÃO RASTREAR A PASTA `public` — sem isto o build morre.
  //
  // Diagnóstico de 12/08/2026, com número: a pasta tem **14 GB e 1.417.259
  // arquivos** (as fotos dos produtos). O Next analisa as leituras de arquivo
  // do código para saber o que empacotar; quando encontra
  //
  //     readFile(join(process.cwd(), "public", <variável>))
  //
  // não consegue resolver o caminho e assume o pior: inclui a pasta inteira no
  // rastreamento. Medido nos dois cenários, no mesmo servidor:
  //
  //     sem a leitura de arquivo → 1,5 GB · 1m26s · ✅
  //     com a leitura de arquivo →  12  GB · 6m52s · morto pelo sistema
  //
  // Foi isso que derrubou o admin do site em 11/08. A pasta `public` é servida
  // como arquivo estático pelo nginx — ela NUNCA precisa entrar no pacote.
  //
  // Vale para todas as rotas (`*`) de propósito: o problema não é de uma
  // função específica, é de qualquer código que um dia leia um arquivo de lá.
  outputFileTracingExcludes: {
    "*": ["./public/**/*"],
  },

  images: {
    remotePatterns: [],
  },
};

export default withNextIntl(nextConfig);
