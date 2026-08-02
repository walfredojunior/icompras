import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { changePlan, cancelClient } from "@/lib/clients";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as any;
  const planId = Number(b.planId);
  const interval = b.interval === "yearly" ? "yearly" : "monthly";
  if (!planId) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  await changePlan(Number(id), planId, interval);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  const { id } = await params;
  await cancelClient(Number(id));
  return NextResponse.json({ ok: true });
}
