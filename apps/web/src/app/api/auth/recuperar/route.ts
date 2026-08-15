import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { pool } from "@/lib/db";
import { enviarEmail, montarEmailDeRecuperacao, emailConfigurado } from "@/lib/email";

// PEDIR RECUPERAÇÃO DE SENHA.
//
// ⚠⚠ A RESPOSTA É SEMPRE A MESMA, exista o e-mail ou não.
//
// Parece detalhe e não é: se a tela responder "e-mail não cadastrado", ela vira
// uma ferramenta para descobrir QUEM tem conta aqui — basta ir testando
// endereços. Respondendo igual nos dois casos, quem tenta não descobre nada.
// O custo é que quem digitou errado não recebe aviso; o texto da tela por isso
// diz "se este e-mail estiver cadastrado, enviamos o link".
//
// Também não dizemos se o envio deu certo. Um "falha ao enviar" contaria que o
// endereço existe.

/** Quantos pedidos por e-mail por hora. Evita usar o site para incomodar alguém. */
const MAX_POR_HORA = 3;
const VALIDADE_MIN = 60;

export async function POST(req: Request) {
  let email = "";
  let locale = "pt-BR";
  try {
    const c = await req.json();
    email = String(c?.email ?? "").trim().toLowerCase().slice(0, 200);
    locale = String(c?.locale ?? "pt-BR");
  } catch {
    return NextResponse.json({ ok: true }); // resposta igual até para pedido malformado
  }

  const respostaPadrao = NextResponse.json({ ok: true });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return respostaPadrao;

  try {
    const users = await pool.query("SELECT id, locale FROM app_user WHERE email = ? LIMIT 1", [email]);
    if (!users.length) return respostaPadrao;
    const user = users[0];

    const [recentes] = await pool.query(
      "SELECT COUNT(*) n FROM recuperacao_senha WHERE user_id = ? AND criado_em > NOW() - INTERVAL 1 HOUR",
      [user.id],
    );
    if (Number(recentes?.n ?? 0) >= MAX_POR_HORA) return respostaPadrao;

    // O token vai no e-mail; no banco guardamos só o hash. Se o banco vazar,
    // o que está lá não abre conta nenhuma.
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");

    await pool.query(
      "INSERT INTO recuperacao_senha (token_hash, user_id, expira_em) VALUES (?, ?, NOW() + INTERVAL ? MINUTE)",
      [hash, user.id, VALIDADE_MIN],
    );

    const base = process.env.SITE_URL ?? "https://icompras.com.py";
    const idioma = user.locale || locale;
    const link = `${base}/${idioma}/nova-senha?t=${token}`;
    const { assunto, html, texto } = montarEmailDeRecuperacao(link, idioma);

    if (emailConfigurado()) {
      const r = await enviarEmail(email, assunto, html, texto);
      // Falha de envio fica só no registro do servidor — contar ao visitante
      // revelaria que o e-mail existe.
      if (!r.ok) console.error(`[recuperar] falhou para ${email}: ${r.erro}`);
    } else {
      console.warn("[recuperar] RESEND_API_KEY não configurada — link gerado mas não enviado");
    }
  } catch (e) {
    console.error("[recuperar]", (e as Error).message);
  }

  return respostaPadrao;
}
