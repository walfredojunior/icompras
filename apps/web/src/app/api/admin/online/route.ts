import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { quantosAgora, JANELA_MINUTOS } from "@/lib/online";

// Quantas pessoas estão no site agora. Lido pela tela Admin › Visitas, de 30
// em 30 segundos, enquanto a aba estiver à vista.
//
// ⚠ NÃO TOCA NO BANCO. É de propósito: um número que se atualiza sozinho a
// cada 30 segundos não pode custar consulta nenhuma, senão a própria tela de
// medir audiência vira carga. Aqui só se lê um Map da memória do processo —
// ver `lib/online.ts`.
export async function GET() {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  return NextResponse.json(
    { agora: quantosAgora(), janelaMinutos: JANELA_MINUTOS },
    // Sem cache em lugar nenhum: um número "ao vivo" servido de cache seria
    // pior que não mostrá-lo, porque parece atual e não é.
    { headers: { "Cache-Control": "no-store" } },
  );
}
