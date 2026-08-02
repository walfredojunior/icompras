import { setRequestLocale } from "next-intl/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const admin = await getCurrentAdmin();
  // Página de login (não autenticado): sem menu lateral.
  if (!admin) return <>{children}</>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <AdminSidebar email={admin.email} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
