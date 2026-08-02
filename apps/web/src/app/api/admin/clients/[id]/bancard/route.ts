import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { createBancardCheckout } from "@/lib/clients";
import { bancardConfigured } from "@/lib/bancard";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  if (!bancardConfigured()) return NextResponse.json({ error: "Bancard não está configurado." }, { status: 400 });
  const { id } = await params;
  const origin = new URL(req.url).origin;
  try {
    const { processId } = await createBancardCheckout(Number(id), origin);
    return NextResponse.json({ processId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
