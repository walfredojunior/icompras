import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { searchOnboardStores, onboardClient, createStore } from "@/lib/clients";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ stores: [] });
  return NextResponse.json({ stores: await searchOnboardStores(q) });
}

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as any;
  let storeId = Number(b.storeId);
  const planId = Number(b.planId);
  const interval = b.interval === "yearly" ? "yearly" : "monthly";
  const mode = b.mode === "paid" ? "paid" : "trial";
  const newStoreName = String(b.newStoreName ?? "").trim();
  if (!planId) return NextResponse.json({ error: "Plano é obrigatório." }, { status: 400 });
  if (!storeId && !newStoreName) return NextResponse.json({ error: "Escolha uma loja ou informe o nome da nova." }, { status: 400 });
  try {
    if (!storeId && newStoreName) storeId = await createStore(newStoreName);
    const subId = await onboardClient(storeId, planId, interval, mode);
    return NextResponse.json({ ok: true, subId, storeId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
