import { setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/components/AuthForm";

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Administrador</h1>
      <p className="mb-6 text-sm text-slate-500">Área restrita de gestão do site.</p>
      <AuthForm
        mode="login"
        endpoint="/api/admin/login"
        redirectTo="/admin"
        switchHref={`/${locale}`}
        dict={{
          email: "E-mail",
          password: "Senha",
          name: "",
          submit: "Entrar",
          switchText: "",
          switchLink: "← Voltar ao site",
        }}
      />
    </div>
  );
}
