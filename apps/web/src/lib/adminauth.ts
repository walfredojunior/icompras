import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { pool } from "./db";
import { hashPassword, verifyPassword } from "./auth";

// ⚠ SEM `AUTH_SECRET`, EM PRODUÇÃO, NINGUÉM ENTRA — de propósito.
//
// Até 10/08/2026 esta linha era `process.env.AUTH_SECRET ?? "dev-secret-troque"`.
// Se a variável sumisse do servidor (um `.env` sobrescrito num deploy, por
// exemplo), o site subia normalmente e passava a assinar os cookies de
// administrador com uma chave que está **escrita no código, no GitHub**.
// Qualquer pessoa forjaria um cookie de admin — e nada na tela denunciaria
// isso: tudo continuaria "funcionando".
//
// Agora falha fechado: sem chave de verdade em produção, `sign` e `verify`
// recusam, ninguém entra, e o registro do servidor grita o motivo. Preferir o
// painel inacessível a ele acessível por qualquer um.
const SECRET = (() => {
  const s = process.env.AUTH_SECRET;
  if (s && s.trim().length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "⛔ AUTH_SECRET ausente ou curta demais (mínimo 16 caracteres). " +
        "O acesso ao painel de administração fica BLOQUEADO até que ela seja definida.",
    );
    return null;
  }
  return "dev-secret-troque"; // só no computador de desenvolvimento
})();

const COOKIE = "icompras_admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@icompras.local";
// ⚠ SEM SENHA PADRÃO ESCRITA AQUI.
//
// Esta linha trazia uma senha de administrador em texto puro como valor
// padrão — ou seja, no código, e portanto no GitHub. Hoje ela seria inerte,
// porque existe linha em `admin_user` e é ela que manda; mas se alguém
// apagasse essa linha para "recuperar o acesso", o painel voltaria a aceitar
// uma senha que qualquer um lê no repositório.
//
// Sem `ADMIN_PASSWORD` definida, o caminho do `.env` simplesmente não
// autentica ninguém. É o mesmo princípio do AUTH_SECRET logo acima: falhar
// fechado. Quem descobriu isto foi a trava anti-segredo do próprio "salve
// tudo", que recusou publicar o repositório enquanto essa senha estivesse
// escrita aqui.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? null;

/**
 * Prazo da sessão do administrador. Antes disto o cookie tinha prazo só no
 * NAVEGADOR (`maxAge`) — o que é sugestão, não regra: o texto assinado valia
 * para sempre, e quem o guardasse entraria meses depois. Agora o prazo é
 * conferido aqui, no servidor.
 */
const SESSAO_DIAS = Number(process.env.ADMIN_SESSION_DAYS ?? 7);

function sign(payload: object): string {
  if (!SECRET) throw new Error("AUTH_SECRET ausente: recusando criar sessão de administrador");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify(token: string): { admin?: boolean; iat?: number } | null {
  if (!SECRET) return null; // sem chave, nenhum cookie vale
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(data).digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return null;
  }
}

// Senha guardada no banco (criptografada). Enquanto não existir, vale a do
// .env — assim a atualização não tranca ninguém do lado de fora.
async function storedAdmin(): Promise<{ email: string; password_hash: string } | null> {
  try {
    const rows = await pool.query("SELECT email, password_hash FROM admin_user WHERE id = 1");
    return rows.length ? rows[0] : null;
  } catch {
    return null; // banco ainda sem a tabela
  }
}

export async function checkAdminCredentials(email: string, password: string): Promise<boolean> {
  // E-mail tolerante (celular costuma capitalizar/adicionar espaço); senha exata.
  const informado = email.trim().toLowerCase();
  const senha = password.trim();

  const guardado = await storedAdmin();
  if (guardado) {
    return informado === guardado.email.trim().toLowerCase() && verifyPassword(senha, guardado.password_hash);
  }
  // Sem senha definida no ambiente, este caminho não autentica ninguém — em
  // vez de comparar contra um padrão que está no código.
  if (!ADMIN_PASSWORD) return false;
  return informado === ADMIN_EMAIL.trim().toLowerCase() && senha === ADMIN_PASSWORD;
}

// Grava a nova senha (criptografada). A partir daí a senha do .env deixa de
// valer — para recuperar o acesso, apagar a linha da tabela admin_user.
export async function setAdminPassword(novaSenha: string): Promise<void> {
  const guardado = await storedAdmin();
  const email = guardado?.email ?? ADMIN_EMAIL;
  await pool.query(
    // `sessions_from = NOW()` junto: trocar a senha DERRUBA todas as sessões
    // abertas, em qualquer aparelho. Sem isto — que era o caso até 10/08/2026 —
    // quem já estivesse dentro continuava dentro, e a troca de senha só
    // trancava a porta para quem chegasse depois.
    `INSERT INTO admin_user (id, email, password_hash, sessions_from) VALUES (1, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), sessions_from = NOW()`,
    [email, hashPassword(novaSenha)],
  );
}

export async function createAdminSession(): Promise<void> {
  (await cookies()).set(COOKIE, sign({ admin: true, iat: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    // Em produção o cookie só viaja por HTTPS (evita a sessão vazar em http://).
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentAdmin(): Promise<{ email: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload?.admin) return null;

  // 1) PRAZO. O `maxAge` do cookie é conferido pelo navegador — e navegador é
  //    do outro lado. Quem guardasse o texto assinado entraria meses depois.
  //    Aqui o prazo vale de verdade.
  const nascida = Number(payload.iat ?? 0);
  if (!nascida || Date.now() - nascida > SESSAO_DIAS * 24 * 60 * 60 * 1000) return null;

  // 2) CORTE. Trocar a senha (ou pedir "sair de todos os aparelhos") empurra
  //    `sessions_from` para agora, e toda sessão nascida antes morre — em
  //    qualquer aparelho, sem depender de apagar cookie nenhum.
  const corte = await cortoDasSessoes();
  if (corte && nascida < corte) return null;

  return { email: ADMIN_EMAIL };
}

/** A data-corte guardada no banco. Null = sem corte. */
async function cortoDasSessoes(): Promise<number | null> {
  try {
    const [r] = await pool.query("SELECT sessions_from FROM admin_user WHERE id = 1");
    const d = r?.sessions_from;
    return d ? new Date(d).getTime() : null;
  } catch {
    // Banco fora do ar ou coluna ainda não criada: NÃO derruba a sessão. Este
    // corte é uma trava a mais, não a autenticação — a assinatura e o prazo já
    // foram conferidos acima.
    return null;
  }
}

/**
 * Derruba TODAS as sessões de administrador, em todos os aparelhos.
 *
 * É o que faltava para o "Sair" significar alguma coisa: até 10/08/2026 ele só
 * apagava o cookie do navegador em que foi clicado — o mesmo texto assinado,
 * copiado em outro lugar, continuava entrando.
 */
export async function encerrarTodasAsSessoes(): Promise<void> {
  // ⚠ SÓ UPDATE, NUNCA INSERT. A primeira versão disto era um INSERT ... ON
  // DUPLICATE KEY, e ele criaria a linha com `password_hash` VAZIO caso ainda
  // não existisse. A partir daí `checkAdminCredentials` passaria a comparar
  // contra o hash guardado (vazio) em vez da senha do `.env` — e o dono ficaria
  // trancado do lado de fora do próprio painel, sem entender por quê.
  //
  // Se a linha não existe, é porque a senha ainda é a do `.env` e nunca houve
  // troca; não há sessão antiga para cortar que valha o risco.
  await pool.query("UPDATE admin_user SET sessions_from = NOW() WHERE id = 1");
}
