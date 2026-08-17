// A CATEGORIA QUE A FONTE DECLARA — ler da página e casar com a nossa árvore.
//
// ====================================================================
// POR QUE ESTE ARQUIVO EXISTE
// ====================================================================
// Esta leitura estava COPIADA em dois lugares — o coletor (`scripts/crawl.ts`)
// e a recuperação em massa (`scripts/recuperar-categoria.ts`) — com um aviso
// em comentário dizendo "se mudar aqui, mudar lá". Aviso não impede ninguém de
// mudar só um lado, e o estrago seria silencioso: o mesmo produto trocaria de
// categoria conforme quem passasse por ele por último.
//
// ====================================================================
// O QUE A FONTE DECLARA
// ====================================================================
// Cada página de produto traz, nos dados estruturados do cabeçalho,
// `"category": "Cosmético"`. **Ler isso bate qualquer adivinhação**: a nossa
// taxonomia nasceu da árvore dela, então 505 das 506 categorias têm o mesmo
// nome. Em 16/08/2026 essa leitura recuperou 117.628 produtos de uma vez.
//
// ⚠ SÓ O QUE ESTÁ DECLARADO. Sem declaração, devolve null — nunca chuta.
// Categoria errada engana MAIS que categoria nenhuma: quem filtra "informática"
// e encontra secador de cabelo perde a confiança no filtro inteiro.

/**
 * Lê a categoria declarada no JSON-LD da página e devolve no formato dos
 * nossos slugs ("Cosmético" → `cosmetico`). Devolve null se a página não
 * declarar nada aproveitável.
 */
export function lerCategoriaDaFonte(html: string): string | null {
  // O bloco fica no <head>, dentro de <script type="application/ld+json">.
  // Regex e não JSON.parse: o bloco tem quebras e vírgulas soltas que fazem o
  // parser falhar em algumas páginas, e aqui só interessa um campo.
  const m = html.match(/"category"\s*:\s*"([^"]{2,80})"/);
  if (!m) return null;
  const cru = m[1].trim();
  // Alguns dados estruturados põem uma URL no lugar do nome — não serve.
  if (!cru || /^https?:/i.test(cru)) return null;
  // ⚠ DESFAZ OS CÓDIGOS DO HTML ANTES DE CONVERTER. Numa página, o "&" vem
  // escrito como "&amp;" — e sem isto "Condimentos & Temperos" virava
  // *condimentos-amp-temperos*, que não existe aqui (o nosso é
  // condimentos-temperos), e o produto ficava sem categoria à toa.
  // Apareceu no primeiro teste real, em 16/08/2026: 3 dos 123 produtos.
  const texto = cru
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return (
    texto
      .normalize("NFD")
      // Faixa dos acentos escrita em código (̀-ͯ) e não com os sinais
      // soltos: assim o arquivo sobrevive a qualquer editor e a qualquer
      // conversão de codificação pelo caminho.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || null
  );
}

export interface IndiceCategorias {
  /** slug da nossa categoria → id. */
  porSlug: Map<string, number>;
  /** O mesmo slug sem nenhum traço → slug nosso. Ver `casarCategoria`. */
  semPontuacao: Map<string, string>;
}

/**
 * Prepara os índices de busca a partir das nossas categorias.
 *
 * ⚠ A chave "sem pontuação" foi CONFERIDA contra colisão em 17/08/2026: as 516
 * categorias dão 516 chaves distintas. Se um dia duas categorias diferentes
 * colidirem, a primeira ganha — por isso a conferência tem de ser refeita
 * sempre que a árvore mudar de forma (não a cada categoria nova).
 */
export function indexarCategorias(porSlug: Map<string, number>): IndiceCategorias {
  const semPontuacao = new Map<string, string>();
  for (const slug of porSlug.keys()) {
    const k = slug.replace(/-/g, "");
    if (!semPontuacao.has(k)) semPontuacao.set(k, slug);
  }
  return { porSlug, semPontuacao };
}

/** Como a categoria declarada encontrou a nossa. Serve para auditar. */
export type ComoCasou = "exata" | "pontuacao" | "outros";

export interface Casamento {
  slug: string;
  id: number;
  como: ComoCasou;
}

/**
 * Acha a NOSSA categoria correspondente ao que a fonte declarou.
 *
 * Três tentativas, da mais segura para a menos:
 *
 * 1. **Igual** — o caminho normal, que resolve praticamente tudo.
 *
 * 2. **Só a pontuação difere.** A fonte chama de "Bolsa para Câmera/Filmadora".
 *    O texto do JSON-LD vira `bolsa-para-camera-filmadora` (a barra virou
 *    traço), mas o endereço que ela mesma publica é `/bolsa-para-camerafilmadora/`
 *    (a barra sumiu) — e foi desse endereço que a nossa árvore foi copiada.
 *    **Eram 70 produtos perdidos por uma barra**, mais 7 em "Captura de
 *    Vídeo/TV". Comparar sem nenhum traço faz os dois lados se encontrarem.
 *    Medido em 17/08/2026.
 *
 * 3. **A nossa é a versão "outros".** A fonte declara "Utensílios Domésticos"
 *    e a nossa árvore só tem `outros-utensilios-domesticos`, que é a gaveta
 *    daquela família na própria árvore dela. São poucos produtos, mas o
 *    encaixe é honesto: é a mesma família, no mesmo lugar.
 *
 * Devolve null quando não achou — e aí o produto fica SEM categoria de
 * propósito, com o que a fonte declarou guardado para decidir depois.
 */
export function casarCategoria(declarada: string | null, idx: IndiceCategorias): Casamento | null {
  if (!declarada) return null;

  const exata = idx.porSlug.get(declarada);
  if (exata !== undefined) return { slug: declarada, id: exata, como: "exata" };

  const porPontuacao = idx.semPontuacao.get(declarada.replace(/-/g, ""));
  if (porPontuacao !== undefined) {
    const id = idx.porSlug.get(porPontuacao)!;
    return { slug: porPontuacao, id, como: "pontuacao" };
  }

  // "outras-" existe porque a fonte concorda com o gênero: são
  // `outras-bebidas` e `outros-brinquedos` na mesma árvore.
  for (const prefixo of ["outros-", "outras-"]) {
    const alvo = prefixo + declarada;
    const id = idx.porSlug.get(alvo);
    if (id !== undefined) return { slug: alvo, id, como: "outros" };
  }

  return null;
}
