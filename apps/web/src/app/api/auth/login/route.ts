import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  }
  const rows = await pool.query("SELECT id, password_hash FROM app_user WHERE email = ? LIMIT 1", [email]);
  if (!rows.length || !rows[0].password_hash || !verifyPassword(password, rows[0].password_hash)) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
  await createSession(Number(rows[0].id));
  return NextResponse.json({ ok: true });
}
