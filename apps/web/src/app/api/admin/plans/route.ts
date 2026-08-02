import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { upsertPlan } from "@/lib/billing";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as any;

  const name = String(b.name ?? "").trim();
  const priceMonthly = Number(b.priceMonthly);
  if (!name || !(priceMonthly >= 0)) {
    return NextResponse.json({ error: "Nome e preço mensal são obrigatórios." }, { status: 400 });
  }

  await upsertPlan({
    id: b.id ? Number(b.id) : undefined,
    name,
    priceMonthly,
    priceYearly: b.priceYearly != null && b.priceYearly !== "" ? Number(b.priceYearly) : undefined,
    trialDays: Number(b.trialDays ?? 30),
    maxProducts: Number(b.maxProducts ?? 0),
    maxApiPerDay: Number(b.maxApiPerDay ?? 0),
    active: b.active !== false,
    public: b.public !== false,
  });

  return NextResponse.json({ ok: true });
}
