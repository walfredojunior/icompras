import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/storeauth";
import { produtosDaLoja, analiseAtiva } from "@/lib/produtosDaLoja";
import { ProdutosDaLoja } from "@/components/ProdutosDaLoja";

export const metadata = { robots: { index: false, follow: false } };

export default async function PainelProdutosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loja = await getCurrentStore();
  if (!loja) redirect(`/${locale}/painel/entrar`);

  const [itens, ativa] = await Promise.all([produtosDaLoja(loja.id), analiseAtiva(loja.id)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Meus produtos</h1>
      <p className="mt-1 text-sm text-slate-500">
        Complete foto, descrição e ficha técnica, e libere o que deve aparecer no iCompras. Produto com
        foto é clicado muito mais que produto sem.
      </p>

      <div className="mt-6">
        <ProdutosDaLoja inicial={itens} analiseAtiva={ativa} />
      </div>
    </div>
  );
}
