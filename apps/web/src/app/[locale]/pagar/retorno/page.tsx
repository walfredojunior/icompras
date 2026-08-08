import { setRequestLocale } from "next-intl/server";

export default async function RetornoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green-light text-2xl text-brand-green-dark">
        ✓
      </div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Pagamento processado</h1>
      <p className="text-slate-600">
        Obrigado! Assim que o Bancard confirmar, a assinatura é renovada automaticamente. Pode fechar esta janela.
      </p>
    </div>
  );
}

// Página de conta: nada a indexar, e algumas exigem senha. `follow` desligado
// porque daqui não sai link que interesse ao buscador.
export const metadata = { robots: { index: false, follow: false } };
