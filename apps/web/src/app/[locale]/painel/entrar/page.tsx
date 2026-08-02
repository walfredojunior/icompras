import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";

export default async function StoreLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("panel");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">{t("loginTitle")}</h1>
      <p className="mb-6 text-sm text-slate-500">{t("subtitle")}</p>
      <AuthForm
        mode="login"
        endpoint="/api/store/login"
        redirectTo="/painel"
        switchHref={`/${locale}/painel/cadastro`}
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
