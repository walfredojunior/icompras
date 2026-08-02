import { createHmac, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { pool } from "./db";

export { hashPassword, verifyPassword } from "./auth";

const SECRET = process.env.AUTH_SECRET ?? "dev-secret-troque";
const COOKIE = "icompras_store";

function sign(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verify(token: string): { sid?: number } | null {
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

// Geração de chave de API (mesmo esquema do @icompras/core: guardamos só o SHA-256).
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("base64url");
  const key = `ic_${secret}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}

export async function createStoreSession(storeId: number): Promise<void> {
  (await cookies()).set(COOKIE, sign({ sid: storeId, iat: Date.now() }), {
    httpOnly: true,
    sameSite: "lax",
    // Em produção o cookie só viaja por HTTPS (evita a sessão vazar em http://).
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroyStoreSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentStore(): Promise<{ id: number; name: string; email: string | null } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload?.sid) return null;
  const rows = await pool.query("SELECT id, name, email FROM store WHERE id = ? LIMIT 1", [payload.sid]);
  if (!rows.length) return null;
  return { id: Number(rows[0].id), name: rows[0].name, email: rows[0].email ?? null };
}
