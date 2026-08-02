import { NextResponse } from "next/server";
import { confirmBancardOp } from "@/lib/clients";

// Webhook de confirmação do Bancard. A validação do token acontece dentro de confirmBancardOp.
export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));
  await confirmBancardOp(payload);
  // Sempre 200 para o Bancard registrar o recebimento (o token evita fraude).
  return NextResponse.json({ status: "success" });
}
