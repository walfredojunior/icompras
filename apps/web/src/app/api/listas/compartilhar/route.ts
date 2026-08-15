import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { pool } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// PUBLICAR UMA LISTA PARA COMPARTILHAR NO WHATSAPP.
//
// A lista vive no navegador. Ela só chega ao servidor quando a pessoa aperta
// "compartilhar" — porque aí ela precisa existir num endereço que outra pessoa
// consiga abrir.
//
// ⚠ ESTE ENDEREÇO É PÚBLICO E GRAVA NO BANCO. É a superfície mais exposta que
// criamos até hoje, então tudo aqui é limitado de propósito:
//   · no máximo 100 itens (bate com o teto do navegador)
//   · nome cortado em 80 caracteres, observação em 120
//   · só ids de produto que EXISTEM — o resto é descartado em silêncio
//   · limite por endereço de origem, para não virar máquina de encher tabela
const MAX_ITENS = 100;
const MAX_POR_IP_HORA = 20;

/** Código do endereço: /lista/a7f3k9x2 */
function novoToken(): string {
  // 8 caracteres de base36 = 2,8 trilhões de combinações. Curto para caber
  // num WhatsApp e impossível de adivinhar por tentativa.
  return randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
}

export async function POST(req: Request) {
  let corpo: any;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "pedido inválido" }, { status: 400 });
  }

  const nome = String(corpo?.nome ?? "").trim().slice(0, 80) || "Lista";
  const brutos = Array.isArray(corpo?.itens) ? corpo.itens : [];
  if (!brutos.length) return NextResponse.json({ erro: "lista vazia" }, { status: 400 });

  const itens = brutos
    .map((i: any) => ({
      p: Number(i?.p),
      q: Math.max(1, Math.min(99, Math.round(Number(i?.q) || 1))),
      o: String(i?.o ?? "").slice(0, 120),
    }))
    .filter((i: any) => Number.isInteger(i.p) && i.p > 0)
    .slice(0, MAX_ITENS);

  if (!itens.length) return NextResponse.json({ erro: "lista vazia" }, { status: 400 });

  // Só ids que existem de verdade. Sem isto, dava para encher a tabela com
  // listas de produtos inventados.
  const vagas = itens.map(() => "?").join(",");
  const existem = await pool.query(
    `SELECT id FROM product WHERE id IN (${vagas})`,
    itens.map((i: any) => i.p),
  );
  const validos = new Set(existem.map((r: any) => Number(r.id)));
  const finais = itens.filter((i: any) => validos.has(i.p));
  if (!finais.length) return NextResponse.json({ erro: "nenhum produto válido" }, { status: 400 });

  // Freio por origem. `x-forwarded-for` vem da Cloudflare; sem ele (chamada
  // local) o freio não se aplica, o que é aceitável porque de fora sempre vem.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (ip) {
    const [r] = await pool.query(
      `SELECT COUNT(*) n FROM lista_compartilhada
        WHERE criada_em > NOW() - INTERVAL 1 HOUR AND JSON_EXTRACT(itens, '$.ip') = ?`,
      [ip],
    ).catch(() => [{ n: 0 }]);
    if (Number(r?.n ?? 0) >= MAX_POR_IP_HORA) {
      return NextResponse.json({ erro: "muitas listas em pouco tempo" }, { status: 429 });
    }
  }

  const user = await getCurrentUser().catch(() => null);

  // Tenta algumas vezes: colisão de token é improvável, mas não impossível.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const token = novoToken();
    try {
      await pool.query(
        "INSERT INTO lista_compartilhada (token, nome, itens, user_id) VALUES (?, ?, ?, ?)",
        [token, nome, JSON.stringify({ v: 1, ip, itens: finais }), user?.id ?? null],
      );
      return NextResponse.json({ token });
    } catch (e: any) {
      if (e?.errno !== 1062) throw e; // 1062 = chave repetida
    }
  }
  return NextResponse.json({ erro: "não consegui gerar o endereço" }, { status: 500 });
}
