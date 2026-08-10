import { NextResponse } from "next/server";
import { getCurrentAdmin, encerrarTodasAsSessoes, destroyAdminSession } from "@/lib/adminauth";

// "Sair de todos os aparelhos".
//
// Existe porque o "Sair" comum nunca desconectou de verdade: ele apagava o
// cookie do navegador em que foi clicado, e o mesmo texto assinado — copiado
// para outro lugar, ou simplesmente aberto noutro computador — continuava
// entrando. Provado por teste em 04/08/2026.
//
// Aqui a sessão não é "apagada": é INVALIDADA no banco, empurrando a data-corte
// para agora. Nenhum cookie emitido antes deste instante vale mais, em lugar
// nenhum, mesmo que a pessoa o tenha guardado.
export async function POST() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });

  await encerrarTodasAsSessoes();
  // Inclusive esta: quem clica neste botão está tentando expulsar alguém, e o
  // mais provável é que queira recomeçar do zero, entrando de novo.
  await destroyAdminSession();
  return NextResponse.json({ ok: true });
}
