import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password, name } = await req.json().catch(() => ({}));
  if (!email || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Dados inválidos (senha mínima de 6 caracteres)." }, { status: 400 });
  }
  const existing = await pool.query("SELECT id FROM app_user WHERE email = ? LIMIT 1", [email]);
  if (existing.length) {
    return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });
  }
  const res = await pool.query(
    "INSERT INTO app_user (email, password_hash, name) VALUES (?, ?, ?)",
    [email, hashPassword(password), name ?? null],
  );
  await createSession(Number(res.insertId));
  return NextResponse.json({ ok: true });
}
