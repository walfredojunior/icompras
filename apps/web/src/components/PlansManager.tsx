"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Plan {
  id: number;
  slug: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  maxProducts: number;
  maxApiPerDay: number;
  active: boolean;
  public: boolean;
}

const EMPTY = {
  id: 0,
  name: "",
  priceMonthly: 100,
  priceYearly: "" as number | "",
  trialDays: 30,
  maxProducts: 0,
  maxApiPerDay: 0,
  active: true,
  public: true,
};

const money = (n: number) => `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function PlansManager({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [f, setF] = useState<typeof EMPTY>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const editing = f.id > 0;
  const yearlySuggestion = Math.round(Number(f.priceMonthly || 0) * 12 * 0.9 * 100) / 100;

  function edit(p: Plan) {
    setF({
      id: p.id,
      name: p.name,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly || "",
      trialDays: p.trialDays,
      maxProducts: p.maxProducts,
      maxApiPerDay: p.maxApiPerDay,
      active: p.active,
      public: p.public,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setSaving(false);
    setF({ ...EMPTY });
    router.refresh();
  }

  async function toggle(p: Plan, field: "active" | "public") {
    await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, [field]: !p[field] }),
    });
    router.refresh();
  }

  async function del(p: Plan) {
    if (!confirm(`Apagar o plano "${p.name}"? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/plans/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Não foi possível apagar o plano.");
      return;
    }
    router.refresh();
  }

  const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-green";

  return (
    <div className="space-y-8">
      {/* Formulário */}
      <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{editing ? `Editar: ${f.name}` : "Novo plano"}</h3>
          {editing && (
            <button type="button" onClick={() => setF({ ...EMPTY })} className="text-xs text-slate-500 hover:text-brand-navy">
              cancelar edição
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-slate-500">
            Nome
            <input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Plano Mensal" required />
          </label>
          <label className="text-xs text-slate-500">
            Preço mensal (US$)
            <input type="number" step="0.01" min="0" className={inp} value={f.priceMonthly} onChange={(e) => setF({ ...f, priceMonthly: Number(e.target.value) })} required />
          </label>
          <label className="text-xs text-slate-500">
            Preço anual (US$) — 10%
            <input type="number" step="0.01" min="0" className={inp} value={f.priceYearly} onChange={(e) => setF({ ...f, priceYearly: e.target.value === "" ? "" : Number(e.target.value) })} placeholder={String(yearlySuggestion)} />
          </label>
          <label className="text-xs text-slate-500">
            Dias de trial
            <input type="number" min="0" className={inp} value={f.trialDays} onChange={(e) => setF({ ...f, trialDays: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            Máx. produtos (0 = ilimitado)
            <input type="number" min="0" className={inp} value={f.maxProducts} onChange={(e) => setF({ ...f, maxProducts: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">
            Máx. requisições/dia (0 = ilimitado)
            <input type="number" min="0" className={inp} value={f.maxApiPerDay} onChange={(e) => setF({ ...f, maxApiPerDay: Number(e.target.value) })} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Ativo
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={f.public} onChange={(e) => setF({ ...f, public: e.target.checked })} />
            Aparece na página de preços
          </label>
          <button disabled={saving} className="ml-auto rounded-lg bg-brand-green px-5 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60">
            {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar plano"}
          </button>
        </div>
      </form>

      {/* Lista */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs text-slate-400">
            <tr>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Mensal</th>
              <th className="px-4 py-3">Anual</th>
              <th className="px-4 py-3">Trial</th>
              <th className="px-4 py-3">Limites</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.slug}{p.currency !== "USD" ? ` · ${p.currency}` : ""}</div>
                </td>
                <td className="px-4 py-3">{p.currency === "USD" ? money(p.priceMonthly) : `${p.priceMonthly} ${p.currency}`}</td>
                <td className="px-4 py-3">{p.currency === "USD" ? money(p.priceYearly) : "—"}</td>
                <td className="px-4 py-3">{p.trialDays}d</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {p.maxProducts === 0 ? "∞ prod." : `${p.maxProducts} prod.`} · {p.maxApiPerDay === 0 ? "∞ req/d" : `${p.maxApiPerDay} req/d`}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(p, "active")} className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? "bg-brand-green-light text-brand-green-dark" : "bg-slate-100 text-slate-500"}`}>
                    {p.active ? "Ativo" : "Inativo"}
                  </button>{" "}
                  <button onClick={() => toggle(p, "public")} className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.public ? "bg-brand-navy/10 text-brand-navy" : "bg-slate-100 text-slate-400"}`}>
                    {p.public ? "Público" : "Oculto"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => edit(p)} className="text-xs font-medium text-brand-navy hover:underline">
                      Editar
                    </button>
                    <button onClick={() => del(p)} className="text-xs font-medium text-red-600 hover:underline">
                      Deletar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
