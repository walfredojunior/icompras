import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { pool } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

// TROCAR A SENHA usando o link recebido por e-mail.
//
// Três travas, e cada uma existe por um motivo:
//   1. o token tem de estar dentro da validade  (link antigo não serve)
//   2. não pode ter sido usado                  (link vale uma vez só)
//   3. é marcado como usado ANTES de trocar     (dois cliques rápidos no
//      mesmo link não viram duas trocas)
const MIN_SENHA = 8;

export async function POST(req: Request) {
  let token = "";
  let senha = "";
  try {
    const c = await req.json();
    token = String(c?.token ?? "");
    senha = String(c?.senha ?? "");
  } catch {
    return NextResponse.json({ erro: "pedido inválido" }, { status: 400 });
  }

  if (senha.length < MIN_SENHA) {
    return NextResponse.json({ erro: "senha-curta", minimo: MIN_SENHA }, { status: 400 });
  }

  const hash = createHash("sha256").update(token).digest("hex");
  const linhas = await pool.query(
    `SELECT token_hash, user_id FROM recuperacao_senha
      WHERE token_hash = ? AND usado_em IS NULL AND expira_em > NOW() LIMIT 1`,
    [hash],
  );
  if (!linhas.length) return NextResponse.json({ erro: "link-invalido" }, { status: 400 });

  const userId = Number(linhas[0].user_id);

  // Marca como usado primeiro: se a troca falhar depois, o pior caso é a
  // pessoa pedir outro link — melhor do que um link que serve duas vezes.
  const r = await pool.query(
    "UPDATE recuperacao_senha SET usado_em = NOW() WHERE token_hash = ? AND usado_em IS NULL",
    [hash],
  );
  if (Number(r?.affectedRows ?? 0) === 0) {
    return NextResponse.json({ erro: "link-invalido" }, { status: 400 });
  }

  await pool.query("UPDATE app_user SET password_hash = ? WHERE id = ?", [hashPassword(senha), userId]);

  // Os outros pedidos em aberto morrem junto: quem trocou a senha não quer
  // links antigos circulando por e-mail.
  await pool.query(
    "UPDATE recuperacao_senha SET usado_em = NOW() WHERE user_id = ? AND usado_em IS NULL",
    [userId],
  );

  await createSession(userId);
  return NextResponse.json({ ok: true });
}
