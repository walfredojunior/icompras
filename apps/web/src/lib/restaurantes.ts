import { pool } from "./db";

// O GUIA "ONDE COMER NO PARAGUAI" (22/08/2026).
//
// ⚠ POR QUE UMA COISA PRÓPRIA, e não mais um banner: ele cobra por ESTAR na
// lista e por ANUNCIAR em cima dela. Se a listagem fosse só uma imagem que leva
// ao Instagram, ela seria o banner — e o cliente pagaria duas vezes pelo mesmo.
//
// 💡 E o Google não lê texto dentro de imagem. Com os dados em campos, a página
// responde "onde comer em Ciudad del Este" e traz visitante NOVO; como figura,
// serviria só para quem já está no site.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type TipoDeComida =
  | "churrascaria"
  | "comida-caseira"
  | "japonesa"
  | "pizzaria"
  | "lanchonete"
  | "padaria"
  | "sorveteria"
  | "buffet"
  | "arabe"
  | "italiana"
  | "outros";

/** Os nomes que aparecem na tela, nos três idiomas do site. */
export const TIPOS: Array<{ id: TipoDeComida; pt: string; es: string; en: string }> = [
  { id: "churrascaria", pt: "Churrascaria", es: "Parrillada", en: "Steakhouse" },
  { id: "comida-caseira", pt: "Comida caseira", es: "Comida casera", en: "Home cooking" },
  { id: "japonesa", pt: "Japonesa", es: "Japonesa", en: "Japanese" },
  { id: "pizzaria", pt: "Pizzaria", es: "Pizzería", en: "Pizzeria" },
  { id: "lanchonete", pt: "Lanchonete", es: "Comida rápida", en: "Snack bar" },
  { id: "padaria", pt: "Padaria", es: "Panadería", en: "Bakery" },
  { id: "sorveteria", pt: "Sorveteria", es: "Heladería", en: "Ice cream" },
  { id: "buffet", pt: "Buffet por quilo", es: "Buffet", en: "Buffet" },
  { id: "arabe", pt: "Árabe", es: "Árabe", en: "Middle Eastern" },
  { id: "italiana", pt: "Italiana", es: "Italiana", en: "Italian" },
  { id: "outros", pt: "Outros", es: "Otros", en: "Other" },
];

export function rotuloDoTipo(tipo: string, locale: string): string {
  const t = TIPOS.find((x) => x.id === tipo);
  if (!t) return tipo;
  return locale === "es" ? t.es : locale === "en" ? t.en : t.pt;
}

export interface Restaurante {
  id: number;
  nome: string;
  slug: string;
  foto_url: string | null;
  cidade: string;
  tipo: string;
  link: string | null;
  whatsapp: string | null;
  endereco: string | null;
  descricao: string | null;
  destaque: number;
  is_paid: number;
  active: number;
  position: number;
  starts_at?: string | null;
  ends_at?: string | null;
  store_id?: number | null;
  store_name?: string | null;
  pedido_numero?: string | null;
}

/**
 * Que tipo de link é este — para a tela mostrar o botão certo.
 *
 * 💡 Ele avisou em 04/08 que restaurante quase nunca tem site: é rede social.
 * Por isso o campo é um só e o sistema reconhece o que foi colado, em vez de
 * obrigar a escolher o tipo numa caixinha.
 */
export function tipoDoLink(url: string | null | undefined): "instagram" | "facebook" | "whatsapp" | "site" | null {
  if (!url?.trim()) return null;
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  if (u.includes("wa.me") || u.includes("whatsapp")) return "whatsapp";
  return "site";
}

/** Endereço pronto para o botão do WhatsApp, a partir do número solto. */
export function linkDoWhatsapp(numero: string | null | undefined): string | null {
  if (!numero?.trim()) return null;
  // Só os dígitos: ele vai digitar "+595 99 123-4567" e o wa.me não aceita isso.
  const so = numero.replace(/\D/g, "");
  if (so.length < 8) return null;
  return `https://wa.me/${so}`;
}

/**
 * Os restaurantes que aparecem no site.
 *
 * ⚠ O PERÍODO MANDA, como nos banners: listagem vendida por um mês sai sozinha
 * no fim do mês. Sem data continua valendo "sempre".
 *
 * 💡 A ORDEM: destaques primeiro (é o que ele vende como "destaque no topo"),
 * depois alfabética. **Não** por quem paga mais — uma lista ordenada por dinheiro
 * sem avisar deixa de ser guia e vira ranking pago disfarçado. Quem é destaque
 * leva selo na tela.
 */
export async function listarRestaurantes(filtros?: {
  cidade?: string;
  tipo?: string;
}): Promise<Restaurante[]> {
  const params: any[] = [];
  let where = `active = 1
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())`;
  if (filtros?.cidade) {
    where += " AND cidade = ?";
    params.push(filtros.cidade);
  }
  if (filtros?.tipo) {
    where += " AND tipo = ?";
    params.push(filtros.tipo);
  }
  const linhas = await pool.query(
    `SELECT * FROM restaurante WHERE ${where} ORDER BY destaque DESC, position, nome`,
    params,
  );
  return linhas.map(normalizar);
}

/** As cidades que têm restaurante no ar — viram o filtro da página. */
export async function cidadesComRestaurante(): Promise<Array<{ cidade: string; n: number }>> {
  const linhas = await pool.query(
    `SELECT cidade, COUNT(*) AS n FROM restaurante
      WHERE active = 1
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at >= NOW())
      GROUP BY cidade ORDER BY n DESC, cidade`,
  );
  return linhas.map((l: any) => ({ cidade: l.cidade, n: Number(l.n) }));
}

/** Todos, para o admin — inclusive os fora do ar e os vencidos. */
export async function listarParaAdmin(): Promise<Restaurante[]> {
  const linhas = await pool.query(
    `SELECT r.*, s.name AS store_name, v.numero AS pedido_numero
       FROM restaurante r
       LEFT JOIN store s ON s.id = r.store_id
       LEFT JOIN (
         SELECT i.restaurante_id, MIN(p.numero) AS numero
           FROM pedido_item i JOIN pedido p ON p.id = i.pedido_id
          WHERE i.restaurante_id IS NOT NULL
          GROUP BY i.restaurante_id
       ) v ON v.restaurante_id = r.id
      ORDER BY r.destaque DESC, r.position, r.nome`,
  );
  return linhas.map(normalizar);
}

function normalizar(l: any): Restaurante {
  return {
    ...l,
    id: Number(l.id),
    destaque: Number(l.destaque ?? 0),
    is_paid: Number(l.is_paid ?? 0),
    active: Number(l.active ?? 1),
    position: Number(l.position ?? 0),
    store_id: l.store_id != null ? Number(l.store_id) : null,
  };
}

/**
 * Gera o endereço curto do restaurante a partir do nome.
 *
 * ⚠ Sem acento e sem sinal: vai virar parte de uma URL. Mesma regra do
 * `slugify` de lib/clients.ts — repetida aqui de propósito para não criar
 * dependência entre duas partes que não têm nada a ver uma com a outra.
 */
export function slugDoNome(nome: string): string {
  return (
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 160) || "restaurante"
  );
}
