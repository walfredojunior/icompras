import { setRequestLocale } from "next-intl/server";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { getClient, getKeyInfo, getPayments, getStoreProfile, getFotosRecusadas } from "@/lib/clients";
import { FotosRecusadas } from "@/components/FotosRecusadas";
import { getAllPlans } from "@/lib/billing";
import { bancardConfigured } from "@/lib/bancard";
import { ClientPanel } from "@/components/ClientPanel";
import { StoreProfileForm } from "@/components/StoreProfileForm";
import { ContaDoCliente } from "@/components/ContaDoCliente";
import { pedidosDaLoja } from "@/lib/pedidos";
import { pool } from "@/lib/db";

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export default async function ClientDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const storeId = Number(id);
  const client = await getClient(storeId);
  if (!client) notFound();

  const [keyInfo, payments, allPlans, profile, fotosRecusadas, pedidos, categorias] = await Promise.all([
    getKeyInfo(storeId),
    getPayments(storeId),
    getAllPlans(),
    getStoreProfile(storeId),
    getFotosRecusadas(storeId),
    pedidosDaLoja(storeId),
    // Alfabética, igual à tela de banners — é a mesma escolha, feita duas vezes.
    pool.query(
      `SELECT c.slug, COALESCE(ct.name, c.slug) AS name
         FROM category c
         LEFT JOIN category_translation ct ON ct.category_id = c.id AND ct.locale = ?
        ORDER BY name`,
      [locale],
    ),
  ]);
  const plans = allPlans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, priceYearly: p.priceYearly }));

  return (
    <div>
      <Link href="/admin/clientes" className="text-xs text-slate-500 hover:text-brand-navy">
        ← Clientes
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-bold text-slate-900">{client.name}</h1>
      <p className="mb-5 text-sm text-slate-500">
        {client.planName ?? "sem plano"} · {client.interval === "yearly" ? "Anual" : "Mensal"} · vencimento {date(client.periodEnd)}
      </p>
      <div className="space-y-6">
        {/* Antes do formulário de propósito: é o que pede ação. Quem abre a
            ficha do cliente precisa ver o problema sem rolar a página. */}
        <FotosRecusadas fotos={fotosRecusadas} />
        {/* A conta vem ANTES do perfil e da chave de API: é o que ele abre a
            ficha para ver quando o assunto é dinheiro. */}
        <ContaDoCliente
          storeId={storeId}
          pedidos={pedidos as any}
          categorias={(categorias as any[]).map((c) => ({ slug: c.slug, name: c.name }))}
        />
        {profile && <StoreProfileForm storeId={storeId} profile={profile} locale={locale} />}
        <ClientPanel
          client={{
            storeId: client.storeId,
            name: client.name,
            planId: client.planId,
            interval: client.interval,
            status: client.status,
            periodEnd: client.periodEnd,
          }}
          plans={plans}
          keyInfo={keyInfo}
          payments={payments}
          bancardEnabled={bancardConfigured()}
          locale={locale}
        />
      </div>
    </div>
  );
}
