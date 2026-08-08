import { setRequestLocale } from "next-intl/server";
import { bancardCheckoutJs } from "@/lib/bancard";
import { BancardCheckout } from "@/components/BancardCheckout";

export default async function PagarPage({ params }: { params: Promise<{ locale: string; processId: string }> }) {
  const { locale, processId } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-1 text-xl font-bold text-slate-900">Pagamento</h1>
      <p className="mb-5 text-sm text-slate-500">Pague com cartão de forma segura pelo Bancard.</p>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <BancardCheckout processId={processId} jsUrl={bancardCheckoutJs()} />
      </div>
    </div>
  );
}

// Página de conta: nada a indexar, e algumas exigem senha. `follow` desligado
// porque daqui não sai link que interesse ao buscador.
export const metadata = { robots: { index: false, follow: false } };
