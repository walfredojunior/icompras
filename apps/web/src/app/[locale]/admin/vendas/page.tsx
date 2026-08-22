import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { pool } from "@/lib/db";
import { resumoComercial, emAbertoPorLoja, pedidosRecentes } from "@/lib/pedidos";
import { AlertTriangle, CalendarClock, Wallet, Receipt } from "lucide-react";

// VENDAS E CONTAS — o painel comercial (21/08/2026).
//
// ⚠ POR QUE EXISTE. A parte de vender publicidade estava espalhada: banners numa
// tela, preços em outra, contas dentro da ficha de cada cliente. Não havia lugar
// nenhum que respondesse as três perguntas de quem vende: **quanto me devem,
// o que vence, e o que está no ar sem ter sido cobrado.**
//
// 💡 Esta tela dá uso a `emAbertoPorLoja()` e `pedidosRecentes()`, que eu havia
// escrito e deixado sem chamar em lugar nenhum — trabalho pronto e guardado.

/* eslint-disable @typescript-eslint/no-explicit-any */

const dol = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
const dia = (s: any) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");

/** Onde se conserta cada tipo de espaço vendido. */
const telaDe = (tipo: string) =>
  tipo === "destaque" ? "/admin/destaques" : tipo === "bloco" ? "/admin/blocos" : "/admin/banners";

export default async function AdminVendasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const [resumo, devedores, pedidos, vencendo, semCobrar] = await Promise.all([
    resumoComercial(),
    emAbertoPorLoja(),
    pedidosRecentes(10),
    pool.query(
      `SELECT b.title, b.category_slug AS onde, b.ends_at, s.name AS store_name, 'banner' AS tipo
         FROM banner b LEFT JOIN store s ON s.id = b.store_id
        WHERE b.active = 1 AND b.ends_at IS NOT NULL
          AND b.ends_at >= NOW() AND b.ends_at <= NOW() + INTERVAL 7 DAY
       UNION ALL
       SELECT p.canonical_name, 'destaque na home', f.ends_at, s.name, 'destaque'
         FROM featured_product f
         JOIN product p ON p.id = f.product_id
         LEFT JOIN store s ON s.id = f.store_id
        WHERE f.ends_at IS NOT NULL AND f.ends_at >= NOW() AND f.ends_at <= NOW() + INTERVAL 7 DAY
       UNION ALL
       SELECT c.title_pt, 'bloco na home', c.ends_at, s.name, 'bloco'
         FROM category_block c LEFT JOIN store s ON s.id = c.store_id
        WHERE c.active = 1 AND c.ends_at IS NOT NULL
          AND c.ends_at >= NOW() AND c.ends_at <= NOW() + INTERVAL 7 DAY
        ORDER BY ends_at`,
    ),
    pool.query(
      `SELECT b.title, CONCAT(COALESCE(b.category_slug,'home'), ' | ', COALESCE(b.slot,'topo')) AS onde,
              s.name AS store_name, 'banner' AS tipo
         FROM banner b LEFT JOIN store s ON s.id = b.store_id
        WHERE b.is_paid = 1 AND b.active = 1
          AND NOT EXISTS (SELECT 1 FROM pedido_item i WHERE i.banner_id = b.id)
       UNION ALL
       SELECT p.canonical_name, 'destaque na home', s.name, 'destaque'
         FROM featured_product f
         JOIN product p ON p.id = f.product_id
         LEFT JOIN store s ON s.id = f.store_id
        WHERE f.is_paid = 1
          AND NOT EXISTS (SELECT 1 FROM pedido_item i WHERE i.destaque_produto_id = f.product_id)
       UNION ALL
       SELECT c.title_pt, 'bloco na home', s.name, 'bloco'
         FROM category_block c LEFT JOIN store s ON s.id = c.store_id
        WHERE c.is_paid = 1 AND c.active = 1
          AND NOT EXISTS (SELECT 1 FROM pedido_item i WHERE i.bloco_id = c.id)`,
    ),
  ]);

  const cartao = "rounded-2xl border border-slate-200 p-4";

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Vendas e contas</h1>
      <p className="mb-5 text-sm text-slate-500">
        O dinheiro da publicidade num lugar só: quem deve, o que vence e o que está no ar sem ter
        sido cobrado.
      </p>

      {/* Os três números que abrem a tela. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={cartao}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
            <Wallet className="h-3.5 w-3.5" /> Em aberto
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{dol(resumo.emAberto)}</div>
          <div className="text-xs text-slate-400">
            {resumo.clientesDevendo} {resumo.clientesDevendo === 1 ? "cliente" : "clientes"}
          </div>
        </div>

        <div className={`${cartao} ${resumo.vencendo7 > 0 ? "border-amber-300 bg-amber-50" : ""}`}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
            <CalendarClock className="h-3.5 w-3.5" /> Vence em 7 dias
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{resumo.vencendo7}</div>
          <div className="text-xs text-slate-400">
            {resumo.vencendo7 === 1 ? "espaço sai do ar" : "espaços saem do ar"}
          </div>
        </div>

        {/* ⚠ O número mais importante da tela: banner publicado que ninguém
            lançou na conta é dinheiro escapando. */}
        <div className={`${cartao} ${resumo.semCobrar > 0 ? "border-red-300 bg-red-50" : ""}`}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
            <AlertTriangle className="h-3.5 w-3.5" /> No ar sem cobrar
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{resumo.semCobrar}</div>
          <div className="text-xs text-slate-400">
            {resumo.semCobrar === 1 ? "espaço pago" : "espaços pagos"}
          </div>
        </div>
      </div>

      {semCobrar.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-red-800">
            No ar sem estar na conta de ninguém
          </h2>
          <ul className="divide-y divide-slate-100 rounded-2xl border border-red-200">
            {semCobrar.map((b: any, i: number) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div>
                  <span className="text-slate-800">{b.title || "(sem título)"}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {b.onde}
                    {b.store_name ? ` · ${b.store_name}` : " · sem loja"}
                  </span>
                </div>
                <Link href={telaDe(b.tipo)} className="text-xs font-medium text-brand-navy hover:underline">
                  abrir →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vencendo.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Vencendo nos próximos 7 dias</h2>
          <ul className="divide-y divide-slate-100 rounded-2xl border border-amber-200">
            {vencendo.map((b: any, i: number) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div>
                  <span className="text-slate-800">{b.title || "(sem título)"}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {b.store_name ?? "sem loja"} · {b.onde}
                  </span>
                </div>
                <span className="text-xs font-medium text-amber-900">até {dia(b.ends_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">Quem deve</h2>
        {devedores.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Ninguém em aberto.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {devedores.map((d) => (
              <li key={d.store_id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate text-slate-800">{d.store_name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-semibold text-slate-900">{dol(d.aberto)}</span>
                  <Link
                    href={`/admin/clientes/${d.store_id}`}
                    className="text-xs font-medium text-brand-navy hover:underline"
                  >
                    abrir
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Receipt className="h-4 w-4 text-slate-400" /> Últimos pedidos
        </h2>
        {pedidos.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum pedido ainda. Eles nascem ao lançar um banner na conta de um cliente.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {pedidos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{p.numero}</span>
                  <span className="ml-2 text-slate-500">{p.store_name}</span>
                  <span className="ml-2 text-xs text-slate-400">
                    {dia(p.emitido_em)} · {p.itens.length} {p.itens.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">{dol(p.total)}</span>
                  {p.aberto > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                      falta {dol(p.aberto)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-brand-green-light px-2 py-0.5 font-semibold text-brand-green-dark">
                      quitado
                    </span>
                  )}
                  <Link
                    href={`/admin/clientes/${p.store_id}`}
                    className="font-medium text-brand-navy hover:underline"
                  >
                    abrir
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
