import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { pool } from "./db";
import { hashPassword, verifyPassword } from "./auth";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-troque";
const COOKIE = "icompras_admin";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@icompras.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

function sign(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify(token: string): { admin?: boolean } | null {
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
  return informado === ADMIN_EMAIL.trim().toLowerCase() && senha === ADMIN_PASSWORD;
}

// Grava a nova senha (criptografada). A partir daí a senha do .env deixa de
// valer — para recuperar o acesso, apagar a linha da tabela admin_user.
export async function setAdminPassword(novaSenha: string): Promise<void> {
  const guardado = await storedAdmin();
  const email = guardado?.email ?? ADMIN_EMAIL;
  await pool.query(
    `INSERT INTO admin_user (id, email, password_hash) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
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
  return payload?.admin ? { email: ADMIN_EMAIL } : null;
}
