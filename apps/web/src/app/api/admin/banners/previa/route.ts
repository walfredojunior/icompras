import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { search } from "@/lib/search";

// Quantos produtos a busca do banner encontra AGORA.
//
// Existe para evitar o pior defeito possível nesta função: um banner bonito que
// leva a uma página vazia. O painel chama isto enquanto o dono digita, e ele vê
// o número antes de salvar — erro de digitação e marca inexistente aparecem na
// hora, em vez de virarem reclamação de visitante depois.
export async function GET(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const tipo = sp.get("tipo");
  const valor = (sp.get("valor") ?? "").trim();
  if (!valor) return NextResponse.json({ total: null });

  try {
    // Uma página de 1 resultado: só interessa o total, não a lista.
    const res =
      tipo === "marca"
        ? await search("", { brands: [valor], perPage: 1 })
        : await search(valor, { perPage: 1 });
    return NextResponse.json({ total: res.total });
  } catch {
    // Meilisearch fora do ar não pode travar o cadastro do banner.
    return NextResponse.json({ total: null });
  }
}
