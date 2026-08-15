import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { FormRecuperar } from "@/components/FormRecuperar";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recuperar" });
  return { title: t("titulo"), robots: { index: false, follow: false } };
}

export default async function RecuperarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "recuperar" });
  const textos = {
    email: t("email"), enviarLink: t("enviarLink"), aviso: t("aviso"),
    enviado: t("enviado"), enviadoTexto: t("enviadoTexto"),
  };
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <header className="mb-6 text-center">
        <KeyRound className="mx-auto h-10 w-10 text-brand-green-dark" />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{t("titulo")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitulo")}</p>
      </header>
      <FormRecuperar locale={locale} textos={textos} />
    </div>
  );
}
