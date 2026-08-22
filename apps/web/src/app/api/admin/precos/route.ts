import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/adminauth";

// Alterar um preço da tabela de divulgação.
//
// ⚠ SÓ MEXE NOS VALORES. Serviço, espaço e faixa não são editáveis: eles são a
// identidade da linha e existem em combinações fixas (3 espaços × 3 faixas +
// os serviços avulsos). Deixar mudar isso pela tela criaria duplicatas — duas
// linhas para "topo · grande" — e a busca de preço passaria a depender de qual
// veio primeiro.

export async function POST(req: Request) {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: "Linha não informada." }, { status: 400 });

  const mensal = Number(b.valor_mensal);
  if (!Number.isFinite(mensal) || mensal < 0) {
    return NextResponse.json({ error: "O valor do mês precisa ser um número." }, { status: 400 });
  }
  // Trimestre e semestre são opcionais: quem vende só por mês deixa em branco.
  const tri = b.valor_trimestral == null || b.valor_trimestral === "" ? null : Number(b.valor_trimestral);
  const sem = b.valor_semestral == null || b.valor_semestral === "" ? null : Number(b.valor_semestral);
  if ((tri != null && !Number.isFinite(tri)) || (sem != null && !Number.isFinite(sem))) {
    return NextResponse.json({ error: "Valor de trimestre ou semestre inválido." }, { status: 400 });
  }

  await pool.query(
    `UPDATE preco_tabela SET valor_mensal = ?, valor_trimestral = ?, valor_semestral = ? WHERE id = ?`,
    [mensal, tri, sem, id],
  );
  return NextResponse.json({ ok: true });
}
