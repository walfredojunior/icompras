import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";

export default async function StoreRegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("panel");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">{t("registerTitle")}</h1>
      <p className="mb-6 text-sm text-slate-500">{t("subtitle")}</p>
      <AuthForm
        mode="register"
        endpoint="/api/store/register"
        redirectTo="/painel"
        switchHref={`/${locale}/painel/entrar`}
        dict={{
          email: t("email"),
          password: t("password"),
          name: t("storeName"),
          submit: t("registerSubmit"),
          switchText: t("haveAccount"),
          switchLink: t("loginLink"),
        }}
      />
    </div>
  );
}

// Página de conta: nada a indexar, e algumas exigem senha. `follow` desligado
// porque daqui não sai link que interesse ao buscador.
export const metadata = { robots: { index: false, follow: false } };
