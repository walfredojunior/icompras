"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  CamposDeVenda,
  VENDA_VAZIA,
  type DadosDaVenda,
  type LinhaDePrecoLite,
} from "./CamposDeVenda";

interface ProductLite {
  id: number;
  name: string;
  brand: string | null;
  slug?: string;
  /** Dados de venda, quando o destaque foi vendido a um cliente. */
  store_name?: string | null;
  is_paid?: number;
  starts_at?: string | null;
  ends_at?: string | null;
  pedido_numero?: string | null;
}

const dia = (s: string | null | undefined) =>
  s ? String(s).slice(0, 10).split("-").reverse().join("/") : "";

export function FeaturedManager({
  featured,
  stores,
  precos,
}: {
  featured: ProductLite[];
  stores: Array<{ id: number; name: string }>;
  precos: LinhaDePrecoLite[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [searching, setSearching] = useState(false);
  // O produto escolhido, esperando os dados da venda. Sem isto, destacar era um
  // clique só e não havia onde dizer para quem, por quanto e até quando.
  const [escolhido, setEscolhido] = useState<ProductLite | null>(null);
  const [venda, setVenda] = useState<DadosDaVenda>(VENDA_VAZIA);
  const [err, setErr] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    const res = await fetch(`/api/admin/products?q=${encodeURIComponent(q)}`);
    const j = await res.json().catch(() => ({}));
    setResults(j.products ?? []);
    setSearching(false);
  }
  async function add(productId: number) {
    setErr(null);
    const res = await fetch("/api/admin/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        store_id: venda.store_id || null,
        is_paid: venda.is_paid,
        starts_at: venda.starts_at || null,
        ends_at: venda.ends_at || null,
        valor: venda.valor ? Number(venda.valor) : null,
        duracao: venda.duracao,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Não deu certo.");
      return;
    }
    setResults([]);
    setQ("");
    setEscolhido(null);
    setVenda(VENDA_VAZIA);
    router.refresh();
  }
  async function remove(productId: number) {
    await fetch(`/api/admin/featured/${productId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto para destacar…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={searching} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark">
          Buscar
        </button>
      </form>

      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {results.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{p.name}</span>
              <button
                onClick={() => setEscolhido(p)}
                className="text-xs font-medium text-brand-green-dark hover:underline"
              >
                + destacar
              </button>
            </li>
          ))}
        </ul>
      )}

      {escolhido && (
        <div className="mt-3 rounded-2xl border border-brand-green p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">Destacar: {escolhido.name}</p>
            <button
              onClick={() => {
                setEscolhido(null);
                setVenda(VENDA_VAZIA);
                setErr(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              cancelar
            </button>
          </div>
          <CamposDeVenda
            dados={venda}
            onChange={setVenda}
            stores={stores}
            precos={precos}
            servico="destaque"
            titulo="Quem paga por este destaque"
          />
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button
            onClick={() => add(escolhido.id)}
            className="mt-3 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark"
          >
            Colocar em destaque
          </button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {featured.length === 0 && <li className="text-sm text-slate-500">Nenhum produto em destaque.</li>}
        {featured.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{p.name}</p>
              {(p.store_name || p.ends_at || p.is_paid) && (
                <p className="text-[11px] text-slate-400">
                  {p.store_name ?? "sem cliente"}
                  {p.is_paid ? " · pago" : ""}
                  {p.ends_at ? ` · até ${dia(p.ends_at)}` : ""}
                </p>
              )}
              {/* ⚠ O mesmo aviso dos banners: vendido e no ar sem estar na
                  conta de ninguém é dinheiro escapando. */}
              {p.is_paid === 1 && !p.pedido_numero && (
                <p className="text-[11px] font-medium text-amber-700">⚠ ainda não está na conta</p>
              )}
              {p.pedido_numero && (
                <p className="text-[11px] text-brand-green-dark">✓ na conta · pedido {p.pedido_numero}</p>
              )}
            </div>
            <button onClick={() => remove(p.id)} className="shrink-0 text-xs text-red-500 hover:text-red-700">
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
