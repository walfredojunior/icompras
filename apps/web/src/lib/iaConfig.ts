import { pool } from "./db";
import { cifrar, decifrar, mascarar } from "./segredos";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Leitura e gravação das configurações de IA (migração 053).
//
// ⚠ Esta camada existe para que NENHUMA chave chegue ao navegador. A tela
// recebe só "definida / não definida" e os últimos quatro caracteres; quem
// decifra de verdade é o servidor, na hora de chamar o provedor.

export interface IaVista {
  texto: {
    ativo: boolean;
    provider: string;
    model: string;
    chave: string | null; // mascarada
    limiteMes: number;
    usoMes: number;
    falhasMes: number;
  };
  imagem: {
    ativo: boolean;
    provider: string;
    model: string;
    chaves: { fal: string | null; openai: string | null; google: string | null };
    limiteMes: number;
    usoMes: number;
    falhasMes: number;
  };
  busca: {
    ativo: boolean;
    provider: string;
    chave: string | null;
    cx: string | null;
    limiteDia: number;
    usoHoje: number;
    falhasHoje: number;
  };
}

/**
 * Onde ver saldo e gerar chave de cada provedor.
 *
 * 💡 Copiado do KaruGO-Chef, que guarda isto num arquivo de configuração e
 * mostra na própria tela. É o mesmo espírito da página de Anotações: a pergunta
 * "onde eu vejo isso mesmo?" aparece justamente no dia em que algo parou de
 * funcionar, que é o pior dia para procurar.
 */
export const ONDE_OLHAR: Record<string, { nome: string; saldo: string; chaves: string; nota?: string }> = {
  deepseek: {
    nome: "DeepSeek",
    saldo: "https://platform.deepseek.com/usage",
    chaves: "https://platform.deepseek.com/api_keys",
    nota: "Pré-pago. Saldo zerado = a API passa a recusar.",
  },
  fal: {
    nome: "fal.ai (FLUX)",
    saldo: "https://fal.ai/dashboard/usage-billing/credits",
    chaves: "https://fal.ai/dashboard/keys",
    nota: "Pré-pago: saldo zerado bloqueia a conta (responde «Exhausted balance»).",
  },
  openai: {
    nome: "OpenAI (GPT Image)",
    saldo: "https://platform.openai.com/settings/organization/billing/overview",
    chaves: "https://platform.openai.com/api-keys",
    nota: "Exige saldo/faturamento ativo na organização.",
  },
  google: {
    nome: "Google (Nano Banana / CSE)",
    saldo: "https://console.cloud.google.com/billing",
    chaves: "https://aistudio.google.com/api-keys",
    nota: "Geração de imagem não tem camada gratuita: o projeto precisa de faturamento ativo.",
  },
};

async function linha(): Promise<any> {
  const [r] = await pool.query("SELECT * FROM ia_config WHERE id = 1").catch(() => [null]);
  return r ?? {};
}

async function uso(servico: string, desde: "mes" | "dia") {
  const [r] = await pool
    .query(
      `SELECT IFNULL(SUM(chamadas),0) AS n, IFNULL(SUM(falhas),0) AS f
         FROM ia_uso
        WHERE servico = ?
          AND day >= ${desde === "mes" ? "DATE_FORMAT(CURDATE(), '%Y-%m-01')" : "CURDATE()"}`,
      [servico],
    )
    .catch(() => [null]);
  return { n: Number(r?.n ?? 0), f: Number(r?.f ?? 0) };
}

/** O que a tela mostra — sem nenhuma chave legível. */
export async function verConfig(): Promise<IaVista> {
  const c = await linha();
  const [ut, ui, ub] = await Promise.all([uso("texto", "mes"), uso("imagem", "mes"), uso("busca", "dia")]);
  const m = (v: any) => mascarar(decifrar(v));
  return {
    texto: {
      ativo: Boolean(c.texto_ativo),
      provider: c.texto_provider ?? "deepseek",
      model: c.texto_model ?? "deepseek-chat",
      chave: m(c.texto_key),
      limiteMes: Number(c.texto_limite_mes ?? 0),
      usoMes: ut.n,
      falhasMes: ut.f,
    },
    imagem: {
      ativo: Boolean(c.img_ativo),
      provider: c.img_provider ?? "fal",
      model: c.img_model ?? "",
      chaves: { fal: m(c.img_key_fal), openai: m(c.img_key_openai), google: m(c.img_key_google) },
      limiteMes: Number(c.img_limite_mes ?? 0),
      usoMes: ui.n,
      falhasMes: ui.f,
    },
    busca: {
      ativo: Boolean(c.busca_ativo),
      provider: c.busca_provider ?? "google",
      chave: m(c.busca_key),
      cx: c.busca_cx ?? null,
      limiteDia: Number(c.busca_limite_dia ?? 0),
      usoHoje: ub.n,
      falhasHoje: ub.f,
    },
  };
}

/** Campos que a tela pode gravar. Chave vazia = "não mexer nesta". */
const CAMPOS_TEXTO = [
  "texto_ativo",
  "texto_provider",
  "texto_model",
  "texto_limite_mes",
  "img_ativo",
  "img_provider",
  "img_model",
  "img_limite_mes",
  "busca_ativo",
  "busca_provider",
  "busca_cx",
  "busca_limite_dia",
] as const;

const CAMPOS_CHAVE = ["texto_key", "img_key_fal", "img_key_openai", "img_key_google", "busca_key"] as const;

export async function gravarConfig(dados: Record<string, unknown>): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];

  for (const c of CAMPOS_TEXTO) {
    if (dados[c] === undefined) continue;
    sets.push(`${c} = ?`);
    args.push(typeof dados[c] === "boolean" ? (dados[c] ? 1 : 0) : dados[c]);
  }

  for (const c of CAMPOS_CHAVE) {
    const v = dados[c];
    // ⚠ Campo em branco NÃO apaga a chave — a tela nunca recebe o valor atual,
    // então "vazio" quer dizer "não mexi nisso". Para apagar de verdade, a tela
    // manda a palavra APAGAR.
    if (v === undefined || v === null || v === "") continue;
    sets.push(`${c} = ?`);
    args.push(v === "APAGAR" ? null : cifrar(String(v)));
  }

  if (!sets.length) return;
  await pool.query(`UPDATE ia_config SET ${sets.join(", ")} WHERE id = 1`, args);
}

// ---------------------------------------------------------------------------
// O FREIO
// ---------------------------------------------------------------------------

export interface Permissao {
  ok: boolean;
  motivo: string | null;
  /** Chave já decifrada, pronta para chamar o provedor. Null se não pode. */
  chave: string | null;
  provider: string;
  model: string;
}

/**
 * Pode acionar este serviço agora?
 *
 * ⚠ A conta da IA é DELE (decidido em 11/08/2026). Então a resposta padrão a
 * qualquer dúvida é NÃO: serviço desligado, sem chave, sem saldo de teto, ou
 * teto não conferido — nada disso vira "tenta e vê". Um laço numa tela de
 * cliente chamando serviço pago no domingo é prejuízo que ninguém vê até a
 * fatura.
 */
export async function podeUsar(servico: "texto" | "imagem" | "busca"): Promise<Permissao> {
  const c = await linha();
  const vazio = { ok: false, chave: null, provider: "", model: "" };

  if (servico === "texto") {
    if (!c.texto_ativo) return { ...vazio, motivo: "geração de texto desligada" };
    const chave = decifrar(c.texto_key);
    if (!chave) return { ...vazio, motivo: "sem chave do DeepSeek" };
    const u = await uso("texto", "mes");
    const limite = Number(c.texto_limite_mes ?? 0);
    if (limite > 0 && u.n >= limite)
      return { ...vazio, motivo: `teto do mês atingido (${u.n}/${limite})` };
    return { ok: true, motivo: null, chave, provider: c.texto_provider, model: c.texto_model };
  }

  if (servico === "imagem") {
    if (!c.img_ativo) return { ...vazio, motivo: "geração de imagem desligada" };
    const p = String(c.img_provider ?? "fal");
    const chave = decifrar(
      p === "openai" ? c.img_key_openai : p === "google" ? c.img_key_google : c.img_key_fal,
    );
    if (!chave) return { ...vazio, motivo: `sem chave de ${p}` };
    const u = await uso("imagem", "mes");
    const limite = Number(c.img_limite_mes ?? 0);
    if (limite > 0 && u.n >= limite)
      return { ...vazio, motivo: `teto do mês atingido (${u.n}/${limite})` };
    return { ok: true, motivo: null, chave, provider: p, model: c.img_model };
  }

  if (!c.busca_ativo) return { ...vazio, motivo: "busca de imagem desligada" };
  const chave = decifrar(c.busca_key);
  if (!chave) return { ...vazio, motivo: "sem chave da busca" };
  const u = await uso("busca", "dia");
  const limite = Number(c.busca_limite_dia ?? 0);
  if (limite > 0 && u.n >= limite) return { ...vazio, motivo: `cota do dia atingida (${u.n}/${limite})` };
  return { ok: true, motivo: null, chave, provider: c.busca_provider, model: "" };
}

/** Anota o uso — sucesso ou falha. Chamar SEMPRE, inclusive quando dá erro. */
export async function anotarUso(
  servico: "texto" | "imagem" | "busca",
  provider: string,
  ok: boolean,
  detalhe?: string,
): Promise<void> {
  await pool
    .query(
      `INSERT INTO ia_uso (day, servico, provider, chamadas, falhas, detalhe)
       VALUES (CURDATE(), ?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE chamadas = chamadas + 1,
                               falhas = falhas + VALUES(falhas),
                               detalhe = IF(VALUES(falhas) = 1, VALUES(detalhe), detalhe)`,
      [servico, provider, ok ? 0 : 1, detalhe?.slice(0, 255) ?? null],
    )
    .catch(() => {});
}
