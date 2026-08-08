import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getCurrentAdmin } from "@/lib/adminauth";
import { listarAnotacoes } from "@/lib/anotacoes";
import { AnotacoesEditor } from "@/components/AnotacoesEditor";

// A PÁGINA DE ANOTAÇÕES — o mapa de tudo que faz o iCompras funcionar.
//
// Pedido dele em 07/08/2026: "falar de todos os servidores que fazem o iCompras
// funcionar e onde acessar cada servidor e se der os planos etc. Preciso disso
// pra depois lembrar e melhor lugar seria aí no próprio iCompras".
//
// ⚠ O CONTEÚDO VEM DO BANCO, e não daqui. Este arquivo não tem uma senha
// sequer — se tivesse, elas iriam para o GitHub e ficariam no histórico para
// sempre. Ver a migration 045 para a história completa.

export default async function AnotacoesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const anotacoes = await listarAnotacoes();

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="mb-1 text-xl font-bold text-slate-900">Anotações</h1>
        <p className="text-sm text-slate-500">
          Tudo que faz o iCompras funcionar: onde fica, para que serve e como acessar. Você pode
          editar e acrescentar o que quiser.
        </p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          Esta página guarda <strong>as senhas dos servidores</strong>. Quem entrar no admin vê
          tudo daqui. Enquanto a senha do admin for a de fábrica, ela é o elo mais fraco —
          trocá-la em <strong>Admin › Trocar senha</strong> é o que protege esta página.
        </div>
      </div>

      <AnotacoesEditor inicial={anotacoes} />
    </div>
  );
}
