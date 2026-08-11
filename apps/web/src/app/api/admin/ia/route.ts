import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { verConfig, gravarConfig } from "@/lib/iaConfig";

// Configurações dos serviços de IA.
//
// ⚠ O GET NUNCA DEVOLVE CHAVE. `verConfig` já entrega só os últimos quatro
// caracteres — o valor inteiro não sai do servidor, nem para o admin logado.
// Ele não precisa lê-lo de volta: se precisar, está no site do provedor.

export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  return NextResponse.json(await verConfig());
}

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Os tetos são a proteção do bolso dele — número inválido não pode virar
  // "sem limite" por acidente.
  for (const c of ["texto_limite_mes", "img_limite_mes", "busca_limite_dia"]) {
    if (b[c] === undefined) continue;
    const n = Number(b[c]);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "os limites precisam ser números iguais ou maiores que zero" }, { status: 400 });
    }
    b[c] = Math.floor(n);
  }

  await gravarConfig(b);
  return NextResponse.json({ ok: true, config: await verConfig() });
}
