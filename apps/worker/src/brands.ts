// Extração da marca a partir do nome do produto.
//
// A fonte nomeia tudo como "Tipo Marca Modelo":
//   "Celular Xiaomi Redmi Note 12"        -> Xiaomi
//   "Cartão de Memória Sandisk Creator"   -> Sandisk
//   "Perfume Jean Paul Gaultier Divine"   -> Jean Paul Gaultier
//
// O "Tipo" é exatamente a categoria, então basta remover as primeiras
// palavras (o slug da categoria diz quantas são) e ler o que vem depois.
//
// O problema são as marcas de várias palavras. A regra usada: só junta a
// palavra seguinte quando a primeira quase SEMPRE aparece acompanhada dela.
// Assim "Jean" (que vem quase sempre com "Paul Gaultier") vira a marca
// inteira, mas "Xiaomi" (seguido ora de Redmi, ora de Poco, ora de Mi) fica
// sozinho — que é o certo.

const IGNORAR = new Set(["", "-", "/", "com", "de", "da", "do", "para", "e"]);

function palavras(nome: string): string[] {
  return nome.split(/\s+/).filter(Boolean);
}

// Quantas palavras iniciais o nome gasta com o tipo (= a categoria).
function tamanhoDoTipo(categorySlug: string | null): number {
  return categorySlug ? categorySlug.split("-").length : 0;
}

function candidatos(nome: string, categorySlug: string | null): string[] {
  const p = palavras(nome).slice(tamanhoDoTipo(categorySlug));
  const out: string[] = [];
  for (let n = 1; n <= 3 && n <= p.length; n++) {
    const c = p.slice(0, n).join(" ");
    // Marca não começa com número nem é palavrinha de ligação.
    if (/^\d/.test(c) || IGNORAR.has(p[0].toLowerCase())) break;
    out.push(c);
  }
  return out;
}

export interface BrandIndex {
  contagem: Map<string, number>;
}

// Passa por todos os nomes e conta quantas vezes cada início aparece.
export function buildBrandIndex(
  produtos: Array<{ name: string; category: string | null }>,
): BrandIndex {
  const contagem = new Map<string, number>();
  for (const p of produtos) {
    for (const c of candidatos(p.name, p.category)) {
      const k = c.toLowerCase();
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }
  }
  return { contagem };
}

const MIN_OCORRENCIAS = 4; // abaixo disso não dá para afirmar que é marca
// Quanto da frequência da palavra curta precisa vir acompanhada da seguinte
// para considerar que as duas formam o nome da marca. 0,55 junta
// "Maison Alhambra" (0,77) sem juntar "Apple iPhone" (0,57) nem
// "Xiaomi Redmi" — essas primeiras palavras aparecem com muitas
// continuações diferentes, sinal de que já são a marca.
const SEMPRE_JUNTO = 0.7;
// Palavras que sozinhas nunca são marca — forçam a juntar a seguinte.
const NUNCA_SOZINHA = new Set(["al", "la", "le", "de", "da", "el", "maison", "van", "the", "new", "st", "saint", "don", "jean", "paco", "carolina", "victoria", "calvin", "giorgio", "yves", "dolce", "hugo", "antonio", "christian", "mega", "marine"]);

export function brandFromName(
  nome: string,
  categorySlug: string | null,
  idx: BrandIndex,
): string | null {
  const cs = candidatos(nome, categorySlug);
  if (!cs.length) return null;

  let escolhida = cs[0];
  for (let i = 1; i < cs.length; i++) {
    const curta = idx.contagem.get(escolhida.toLowerCase()) ?? 0;
    const longa = idx.contagem.get(cs[i].toLowerCase()) ?? 0;
    if (longa < MIN_OCORRENCIAS || curta === 0) break;
    const ultima = escolhida.split(" ").pop()!.toLowerCase();
    // Palavra que nunca é marca sozinha ("Al", "Jean") sempre puxa a seguinte.
    if (!NUNCA_SOZINHA.has(ultima) && longa / curta < SEMPRE_JUNTO) break;
    escolhida = cs[i];
  }

  // Limpeza final: tira pontuação solta das bordas.
  const limpa = escolhida.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "").trim();
  if (limpa.length < 2 || /^\d+$/.test(limpa)) return null;
  return limpa.slice(0, 60);
}
