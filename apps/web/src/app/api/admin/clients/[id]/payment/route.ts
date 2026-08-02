import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { registerManualPayment } from "@/lib/clients";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as any;
  const method = b.method === "bancard" ? "bancard" : "manual";
  try {
    await registerManualPayment(Number(id), method, b.note ? String(b.note) : undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
