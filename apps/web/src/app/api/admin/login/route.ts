import { NextResponse } from "next/server";
import { checkAdminCredentials, createAdminSession } from "@/lib/adminauth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!(await checkAdminCredentials(email ?? "", password ?? ""))) {
    return NextResponse.json({ error: "Credenciais de administrador inválidas." }, { status: 401 });
  }
  await createAdminSession();
  return NextResponse.json({ ok: true });
}
