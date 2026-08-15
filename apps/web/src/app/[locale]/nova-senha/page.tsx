import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FormNovaSenha } from "@/components/FormNovaSenha";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recuperar" });
  return { title: t("novaSenha"), robots: { index: false, follow: false } };
}

export default async function NovaSenhaPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { t: token } = await searchParams;
  const t = await getTranslations({ locale, namespace: "recuperar" });

  // Sem token no endereço não há o que fazer — e a mensagem manda pedir outro
  // link, em vez de deixar a pessoa numa tela morta.
  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-slate-700">{t("linkInvalido")}</p>
        <Link href="/recuperar" className="mt-4 inline-block rounded-xl bg-brand-navy px-5 py-2.5 text-sm font-medium text-white">
          {t("pedirOutro")}
        </Link>
      </div>
    );
  }

  const textos = {
    novaSenha: t("novaSenha"), repetir: t("repetir"), salvar: t("salvar"),
    minimo: t("minimo"), curta: t("curta"), naoConfere: t("naoConfere"), linkInvalido: t("linkInvalido"),
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <header className="mb-6 text-center">
        <KeyRound className="mx-auto h-10 w-10 text-brand-green-dark" />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{t("novaSenha")}</h1>
      </header>
      <FormNovaSenha token={token} textos={textos} />
    </div>
  );
}
