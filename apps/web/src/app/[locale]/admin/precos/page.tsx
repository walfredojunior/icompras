import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { tabelaDePrecos, produtosPorCategoria, faixaPorTamanho } from "@/lib/precos";
import { TabelaDePrecos } from "@/components/TabelaDePrecos";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function AdminPrecosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const [linhas, porCategoria] = await Promise.all([tabelaDePrecos(), produtosPorCategoria()]);

  // Quantas categorias caem em cada faixa. Serve para ele entender o que está
  // precificando: "grande" são 22 categorias, não uma abstração.
  const contagem = { grande: 0, media: 0, pequena: 0 };
  for (const n of Object.values(porCategoria)) contagem[faixaPorTamanho(n)] += 1;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Tabela de preços</h1>
      <p className="mb-5 text-sm text-slate-500">
        O que você cobra por cada tipo de divulgação. Estes valores aparecem prontos na hora de
        montar um banner e de lançar na conta do cliente.
      </p>
      <TabelaDePrecos linhas={linhas as any} contagem={contagem} />
    </div>
  );
}
