import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { planSubscriberCount, deletePlan } from "@/lib/billing";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const { id } = await params;
  const planId = Number(id);
  if (!planId) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });

  // Protege: não apaga plano que tem cliente(s) usando.
  const count = await planSubscriberCount(planId);
  if (count > 0) {
    return NextResponse.json(
      { error: `Não é possível apagar: ${count} cliente(s) usam este plano. Desative-o em vez de apagar.` },
      { status: 409 },
    );
  }

  await deletePlan(planId);
  return NextResponse.json({ ok: true });
}
