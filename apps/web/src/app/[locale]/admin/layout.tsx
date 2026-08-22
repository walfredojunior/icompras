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

  // ⚠ TARJA DE AMBIENTE LOCAL (21/08/2026). Desde que passamos a testar no PC
  // dele antes de publicar, existem DUAS administrações quase idênticas — e
  // confundir as duas é o erro caro: mexer achando que é teste, ou testar
  // achando que é produção.
  //
  // 💡 Reconhece pelo endereço do banco, não por variável de ambiente: o
  // `NODE_ENV` é "production" tanto no site de verdade quanto num teste de
  // publicação local, então ele mentiria justamente na hora do teste.
  const ehLocal = /^(127\.0\.0\.1|localhost|::1)$/.test(process.env.DB_HOST ?? "");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {ehLocal && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3">
          <span className="text-xl" aria-hidden="true">🧪</span>
          <div>
            <p className="text-sm font-bold text-amber-900">AMBIENTE LOCAL — este não é o site de verdade</p>
            <p className="text-xs text-amber-800">
              Você está no computador, com uma cópia do banco. Nada aqui altera icompras.com.py.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-8 lg:flex-row">
        <AdminSidebar email={admin.email} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
