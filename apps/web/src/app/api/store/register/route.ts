import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword, createStoreSession } from "@/lib/storeauth";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "loja"
  );
}

export async function POST(req: Request) {
  const { name, email, password } = await req.json().catch(() => ({}));
  if (!name || !email || typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Dados inválidos (senha mínima de 6)." }, { status: 400 });
  }
  const existing = await pool.query("SELECT id FROM store WHERE email = ? LIMIT 1", [email]);
  if (existing.length) {
    return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });
  }
  const slug = `${slugify(name)}-${Date.now().toString(36)}`;
  const res = await pool.query(
    "INSERT INTO store (slug, name, email, password_hash, status, source) VALUES (?, ?, ?, ?, 'active', 'api')",
    [slug, name, email, hashPassword(password)],
  );
  await createStoreSession(Number(res.insertId));
  return NextResponse.json({ ok: true });
}
