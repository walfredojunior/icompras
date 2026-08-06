import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// A PORTARIA DAS IMAGENS ENVIADAS PELAS LOJAS.
//
// Contexto (06/08/2026): o dono perguntou como garantir que "a foto é
// realmente uma foto" e como barrar código malicioso. A auditoria mostrou que
// o texto já estava seguro — o React nunca insere HTML cru (não existe um
// `dangerouslySetInnerHTML` no projeto) e as consultas são parametrizadas.
//
// O buraco era a FOTO, e não pelo motivo esperado. `ingestImageFromUrl` fazia
// `fetch(url)` no endereço que a loja mandasse, sem prazo, sem limite de
// tamanho e sem conferir o que voltava. Quatro portas abertas de uma vez.
//
// Decisão do dono: foto recusada NÃO derruba o produto. O anúncio entra sem
// imagem e o motivo fica registrado. "Perder o anúncio inteiro por causa de
// uma imagem ruim castiga o lojista por um erro pequeno."

/** Teto de download. Acima disso a conexão é cortada no meio, sem alocar tudo. */
export const LIMITE_BYTES = 10 * 1024 * 1024;

/** Prazo total. Sem ele, um endereço que entrega 1 byte por minuto prende o worker para sempre. */
export const PRAZO_MS = 10_000;

/** Quantos desvios seguir. Seguimos um a um para poder conferir o destino de cada um. */
const MAX_REDIRECIONAMENTOS = 3;

export type MotivoRecusa =
  | "endereco-invalido"
  | "protocolo-proibido"
  | "endereco-interno"
  | "nao-respondeu"
  | "tipo-nao-e-imagem"
  | "grande-demais"
  | "nao-e-imagem-de-verdade";

export class ImagemRecusada extends Error {
  constructor(readonly motivo: MotivoRecusa, readonly detalhe?: string) {
    super(`imagem recusada: ${motivo}${detalhe ? ` (${detalhe})` : ""}`);
    this.name = "ImagemRecusada";
  }
}

/**
 * Faixas de rede que NÃO podem ser alvo.
 *
 * O ataque que isto barra (SSRF): a loja manda `url_image` apontando para
 * dentro do nosso próprio servidor. Conferido em 06/08/2026, escutando em
 * 127.0.0.1: Meilisearch (7700), Redis (6379) e MariaDB (3306) — tudo que
 * ninguém alcança de fora, mas que o servidor alcança de dentro.
 *
 * `169.254.169.254` tem nome próprio: é o endereço onde provedores de nuvem
 * servem as credenciais da máquina. É o primeiro lugar que um atacante tenta.
 */
/**
 * Abre um IPv6 nos seus 8 grupos, resolvendo o "::" que encurta os zeros.
 *
 * Existe porque a comparação por texto não serve: `::1`, `0:0:0:0:0:0:0:1` e
 * `0000:...:0001` são o MESMO endereço escrito de três jeitos.
 */
function gruposDe(v6: string): number[] | null {
  const [esq, dir] = v6.split("::");
  const a = esq ? esq.split(":").filter(Boolean) : [];
  const b = dir !== undefined ? (dir ? dir.split(":").filter(Boolean) : []) : null;
  const partes = b === null ? a : [...a, ...Array(8 - a.length - b.length).fill("0"), ...b];
  if (partes.length !== 8) return null;
  const nums = partes.map((p) => parseInt(p, 16));
  return nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff) ? null : nums;
}

function ehInterno(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    const g = gruposDe(v6);
    if (!g) return true; // não entendi o endereço: recuso, não arrisco
    if (g.every((n) => n === 0)) return true; // ::
    if (g.slice(0, 7).every((n) => n === 0) && g[7] === 1) return true; // ::1
    if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 — rede local única
    if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 — link-local
    // ⚠ IPv4 DISFARÇADO DE IPv6 — o truque que passou no meu próprio teste.
    //
    // `http://[::ffff:127.0.0.1]/` parece inofensivo, mas o analisador de
    // endereços do Node reescreve para `::ffff:7f00:1` (hexadecimal). Eu
    // procurava o formato com pontos, então o localhost passava direto pela
    // portaria. Comparando pelos GRUPOS o disfarce não existe: os dois viram
    // o mesmo número.
    if (g.slice(0, 5).every((n) => n === 0) && g[5] === 0xffff) {
      const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
      return ehInterno(v4);
    }
    return false;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + metadados da nuvem
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // rede do provedor (CGNAT)
  if (a >= 224) return true; // multicast e reservados
  return false;
}

/**
 * Confere um endereço ANTES de buscá-lo: protocolo e para onde o nome aponta.
 *
 * ⚠ Resolver o nome aqui não basta sozinho — entre esta conferência e o
 * download, o nome poderia mudar de destino (é o ataque de "troca no meio do
 * caminho"). Por isso `buscarImagemComSeguranca` refaz a conferência a cada
 * desvio e busca pelo IP já conferido.
 */
export async function conferirEndereco(bruto: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(bruto);
  } catch {
    throw new ImagemRecusada("endereco-invalido");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    // Barra de uma vez `javascript:`, `data:`, `file:` e afins.
    throw new ImagemRecusada("protocolo-proibido", u.protocol);
  }

  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (ehInterno(host)) throw new ImagemRecusada("endereco-interno", host);
    return u;
  }
  let enderecos: Array<{ address: string }>;
  try {
    enderecos = await lookup(host, { all: true });
  } catch {
    throw new ImagemRecusada("nao-respondeu", "nome não resolve");
  }
  if (!enderecos.length) throw new ImagemRecusada("nao-respondeu", "nome sem endereço");
  // TODOS têm de ser externos: um nome pode responder vários, e basta um
  // interno para o ataque funcionar na tentativa seguinte.
  for (const e of enderecos) {
    if (ehInterno(e.address)) throw new ImagemRecusada("endereco-interno", e.address);
  }
  return u;
}

/**
 * A ASSINATURA DOS BYTES — a checagem que responde de verdade "é uma foto?".
 *
 * Todo formato de imagem começa com uma marca fixa. O cabeçalho `Content-Type`
 * é só o que o outro servidor DIZ que mandou; estes bytes são o que ele mandou
 * de fato. Mentir aqui não adianta: se a marca não bate, o processador de
 * imagem não leria mesmo.
 */
export function pareceImagem(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const hex = buf.subarray(0, 12).toString("hex").toLowerCase();
  const ascii = buf.subarray(0, 12).toString("latin1");
  if (hex.startsWith("ffd8ff")) return true; // JPEG
  if (hex.startsWith("89504e470d0a1a0a")) return true; // PNG
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) return true; // GIF
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return true; // WebP
  if (ascii.slice(4, 8) === "ftyp") return true; // AVIF / HEIC
  if (hex.startsWith("424d")) return true; // BMP
  if (hex.startsWith("49492a00") || hex.startsWith("4d4d002a")) return true; // TIFF
  return false;
}

/**
 * Baixa a imagem com todas as travas.
 *
 * Segue os desvios À MÃO (`redirect: "manual"`) porque o modo automático
 * seguiria para onde quisesse: um endereço externo perfeitamente inocente pode
 * responder "vá para 127.0.0.1" e a conferência inicial não teria valido nada.
 */
export async function buscarImagemComSeguranca(bruto: string): Promise<Buffer> {
  let alvo = await conferirEndereco(bruto);
  const controle = new AbortController();
  const prazo = setTimeout(() => controle.abort(), PRAZO_MS);

  try {
    for (let salto = 0; salto <= MAX_REDIRECIONAMENTOS; salto++) {
      const res = await fetch(alvo, {
        redirect: "manual",
        signal: controle.signal,
        headers: { Accept: "image/*" },
      });

      if (res.status >= 300 && res.status < 400) {
        const destino = res.headers.get("location");
        if (!destino) throw new ImagemRecusada("nao-respondeu", "desvio sem destino");
        // Confere o novo endereço com o MESMO rigor do primeiro.
        alvo = await conferirEndereco(new URL(destino, alvo).toString());
        continue;
      }
      if (!res.ok) throw new ImagemRecusada("nao-respondeu", `HTTP ${res.status}`);

      const tipo = (res.headers.get("content-type") ?? "").toLowerCase();
      if (tipo && !tipo.startsWith("image/")) {
        throw new ImagemRecusada("tipo-nao-e-imagem", tipo.slice(0, 40));
      }
      // O tamanho anunciado, quando existe, evita começar um download inútil.
      const anunciado = Number(res.headers.get("content-length"));
      if (Number.isFinite(anunciado) && anunciado > LIMITE_BYTES) {
        throw new ImagemRecusada("grande-demais", `${Math.round(anunciado / 1024 / 1024)} MB`);
      }

      // Lê em pedaços e CORTA ao passar do teto. `arrayBuffer()` não serve:
      // ele alocaria os 5 GB antes de a gente poder reclamar.
      if (!res.body) throw new ImagemRecusada("nao-respondeu", "sem corpo");
      const pedacos: Buffer[] = [];
      let total = 0;
      for await (const pedaco of res.body as unknown as AsyncIterable<Uint8Array>) {
        total += pedaco.length;
        if (total > LIMITE_BYTES) {
          controle.abort();
          throw new ImagemRecusada("grande-demais", "passou de 10 MB durante o download");
        }
        pedacos.push(Buffer.from(pedaco));
      }

      const buf = Buffer.concat(pedacos);
      if (!pareceImagem(buf)) throw new ImagemRecusada("nao-e-imagem-de-verdade");
      return buf;
    }
    throw new ImagemRecusada("nao-respondeu", "desvios demais");
  } catch (e) {
    if (e instanceof ImagemRecusada) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ImagemRecusada("nao-respondeu", "demorou demais");
    }
    throw new ImagemRecusada("nao-respondeu", e instanceof Error ? e.message.slice(0, 60) : undefined);
  } finally {
    clearTimeout(prazo);
  }
}
