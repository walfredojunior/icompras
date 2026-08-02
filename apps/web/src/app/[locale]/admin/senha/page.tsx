import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { ChangeAdminPassword } from "@/components/ChangeAdminPassword";

export default async function AdminSenhaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await getCurrentAdmin();
  if (!admin) redirect(`/${locale}/admin/entrar`);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Segurança</h1>
      <ChangeAdminPassword email={admin.email} />
    </div>
  );
}
