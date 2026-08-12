import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { pool } from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import { LeadsQuentesBloco, EsqueletoLeads } from "@/components/LeadsQuentesBloco";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PER_PAGE = 48;

export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await getCurrentAdmin();
  if (!admin) redirect(`/${locale}/admin/entrar`);

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page ?? 1));
  const offset = (page - 1) * PER_PAGE;

  const where = q ? "WHERE is_lead = 1 AND name LIKE ?" : "WHERE is_lead = 1";
  const args = q ? [`%${q}%`] : [];

  const totalRow = await pool.query(`SELECT COUNT(*) AS c FROM store ${where}`, args);
  const total = Number(totalRow[0].c);
  const leads = await pool.query(
    `SELECT id, name, external_url, logo_url, phone FROM store ${where} ORDER BY name LIMIT ? OFFSET ?`,
    [...args, PER_PAGE, offset],
  );
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Lojas (leads)</h1>

      {/* Lojas que saíram do concorrente. Vêm ANTES da lista completa porque
          são as únicas com hora marcada — e ficam dentro de um Suspense para
          NÃO segurar o resto da página, que é rápido. */}
      <div className="mt-4">
        <Suspense fallback={<EsqueletoLeads />}>
          <LeadsQuentesBloco />
        </Suspense>
      </div>
      <p className="text-sm text-slate-500">
        {total} loja(s) do comprasparaguai para você convidar a se cadastrar.
      </p>

      <form className="mt-6 flex gap-2" action={`/${locale}/admin/leads`}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar loja pelo nome..."
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm"
        />
        <button className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark">
          Buscar
        </button>
      </form>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {leads.map((s: any) => (
          <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo_url} alt={s.name} className="h-12 w-12 rounded-lg object-contain" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-500">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-800">{s.name}</div>
              {s.phone ? (
                <a
                  href={`https://wa.me/${String(s.phone).replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs font-medium text-brand-green-dark hover:underline"
                >
                  {s.phone} · WhatsApp
                </a>
              ) : null}
              {s.external_url ? (
                <a
                  href={s.external_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block truncate text-xs text-brand-navy hover:underline"
                >
                  {s.external_url.replace(/^https?:\/\//, "")}
                </a>
              ) : !s.phone ? (
                <span className="text-xs text-slate-400">sem contato</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {leads.length === 0 && <p className="mt-8 text-slate-500">Nenhum lead ainda. Rode o crawler.</p>}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`/admin/leads?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page - 1}`} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-slate-300">
              ← Anterior
            </Link>
          )}
          <span className="text-slate-500">Página {page} de {totalPages}</span>
          {page < totalPages && (
            <Link href={`/admin/leads?${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page + 1}`} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-slate-300">
              Próxima →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
