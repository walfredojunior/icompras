import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{t("registerTitle")}</h1>
      <AuthForm
        mode="register"
        switchHref={`/${locale}/entrar`}
        dict={{
          email: t("email"),
          password: t("password"),
          name: t("name"),
          submit: t("registerSubmit"),
          switchText: t("haveAccount"),
          switchLink: t("loginLink"),
        }}
      />
    </div>
  );
}
