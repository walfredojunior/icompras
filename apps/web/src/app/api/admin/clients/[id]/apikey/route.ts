import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { issueApiKey, revokeApiKeys } from "@/lib/clients";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  const { id } = await params;
  const key = await issueApiKey(Number(id));
  return NextResponse.json({ key }); // mostrada só 1 vez
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  const { id } = await params;
  await revokeApiKeys(Number(id));
  return NextResponse.json({ ok: true });
}
