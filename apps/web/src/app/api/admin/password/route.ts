import { NextResponse } from "next/server";
import { getCurrentAdmin, checkAdminCredentials, setAdminPassword } from "@/lib/adminauth";

const MINIMO = 10;

export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }

  const { atual, nova, confirmacao } = await req.json().catch(() => ({}));
  const novaSenha = String(nova ?? "").trim();

  // Confere a senha atual mesmo já estando logado: impede que alguém que
  // pegue o computador aberto troque a senha e tome a conta.
  if (!(await checkAdminCredentials(admin.email, String(atual ?? "")))) {
    return NextResponse.json({ error: "A senha atual está errada." }, { status: 400 });
  }
  if (novaSenha.length < MINIMO) {
    return NextResponse.json({ error: `A nova senha precisa ter pelo menos ${MINIMO} caracteres.` }, { status: 400 });
  }
  if (novaSenha !== String(confirmacao ?? "").trim()) {
    return NextResponse.json({ error: "A confirmação não confere com a nova senha." }, { status: 400 });
  }
  if (novaSenha === String(atual ?? "").trim()) {
    return NextResponse.json({ error: "A nova senha precisa ser diferente da atual." }, { status: 400 });
  }

  await setAdminPassword(novaSenha);
  return NextResponse.json({ ok: true });
}
