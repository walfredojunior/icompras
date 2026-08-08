import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t("loginTitle")}</h1>
      <AuthForm
        mode="login"
        switchHref={`/${locale}/cadastro`}
        dict={{
          email: t("email"),
          password: t("password"),
          name: t("name"),
          submit: t("loginSubmit"),
          switchText: t("noAccount"),
          switchLink: t("registerLink"),
        }}
      />
    </div>
  );
}

// Página de conta: nada a indexar, e algumas exigem senha. `follow` desligado
// porque daqui não sai link que interesse ao buscador.
export const metadata = { robots: { index: false, follow: false } };
