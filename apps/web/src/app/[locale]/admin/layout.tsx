import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { getCurrentAdmin } from "@/lib/adminauth";
import { AdminSidebar } from "@/components/AdminSidebar";

// A administração inteira fica fora do índice — vale para todas as páginas
// abaixo deste layout, inclusive a de Anotações, que tem as senhas dos
// servidores escritas. O robots.txt já pedia para não rastrear, mas ele é um
// pedido de "não visite"; isto aqui é "não guarde", que é o que apaga do
// índice o que por acaso já tenha entrado.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

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
