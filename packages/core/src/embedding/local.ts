// Embedding local, sem dependências externas nem chave de API.
// Estratégia: n-gramas de caracteres (2-3) + tokens, hasheados num vetor de dimensão fixa,
// normalizado L2. Nomes de produto parecidos (com typos/variações) ficam com vetores próximos.

function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function hashEmbed(text: string, dim = 1024): number[] {
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const tokens = norm.split(/\s+/).filter(Boolean);
  const vec = new Array<number>(dim).fill(0);

  for (const tok of tokens) {
    const padded = `#${tok}#`;
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= padded.length; i++) {
        vec[hash32(padded.slice(i, i + n)) % dim] += 1;
      }
    }
    vec[hash32(tok) % dim] += 1; // token inteiro
  }

  let sum = 0;
  for (const v of vec) sum += v * v;
  const norm2 = Math.sqrt(sum) || 1;
  return vec.map((v) => v / norm2);
}
