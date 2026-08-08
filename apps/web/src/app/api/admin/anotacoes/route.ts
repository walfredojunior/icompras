import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { salvarAnotacao, apagarAnotacao } from "@/lib/anotacoes";

// Salvar e apagar anotações. Só para quem já entrou no admin — estas linhas
// guardam as senhas dos servidores.

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as {
    id?: number;
    titulo?: string;
    conteudo?: string;
  };
  if (typeof b.titulo !== "string" || typeof b.conteudo !== "string") {
    return NextResponse.json({ error: "título e conteúdo são obrigatórios" }, { status: 400 });
  }
  const id = await salvarAnotacao({ id: b.id, titulo: b.titulo, conteudo: b.conteudo });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: number };
  if (!b.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  await apagarAnotacao(Number(b.id));
  return NextResponse.json({ ok: true });
}
