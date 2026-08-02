"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PlanOpt {
  id: number;
  name: string;
  priceMonthly: number;
  priceYearly: number;
}
interface StoreHit {
  id: number;
  name: string;
  logo: string | null;
  isLead?: boolean;
  isNew?: boolean;
}

const money = (n: number) => `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function OnboardClient({ plans, locale }: { plans: PlanOpt[]; locale: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StoreHit[]>([]);
  const [sel, setSel] = useState<StoreHit | null>(null);
  const [planId, setPlanId] = useState(plans[0]?.id ?? 0);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [mode, setMode] = useState<"trial" | "paid">("trial");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function search(v: string) {
    setQ(v);
    setSel(null);
    if (v.trim().length < 2) {
      setResults([]);
      return;
    }
    const r = await fetch(`/api/admin/clients?q=${encodeURIComponent(v)}`);
    const j = await r.json().catch(() => ({}));
    setResults(j.stores ?? []);
  }

  async function onboard() {
    if (!sel) return;
    setBusy(true);
    setErr(null);
    const body = sel.isNew
      ? { newStoreName: sel.name, planId, interval, mode }
      : { storeId: sel.id, planId, interval, mode };
    const r = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setErr(j.error ?? "Erro ao cadastrar.");
      return;
    }
    router.push(`/${locale}/admin/clientes/${j.storeId}`);
  }

  const plan = plans.find((p) => p.id === planId);
  const price = plan ? (interval === "yearly" ? plan.priceYearly : plan.priceMonthly) : 0;
  const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-green";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 font-semibold text-slate-900">Cadastrar cliente</h3>

      {/* Busca da loja */}
      <label className="text-xs text-slate-500">Buscar loja (inclui leads do scraper)</label>
      <input className={inp} value={q} onChange={(e) => search(e.target.value)} placeholder="Nome da loja..." />
      {!sel && q.trim().length >= 2 && (
        <div className="mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200">
          {results.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSel(s);
                setResults([]);
                setQ(s.name);
              }}
              className="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              {s.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo} alt="" className="h-6 w-6 rounded object-contain" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-xs text-slate-500">{s.name.slice(0, 1)}</span>
              )}
              <span className="flex-1 truncate">{s.name}</span>
              {s.isLead && <span className="text-[10px] text-slate-400">lead</span>}
            </button>
          ))}
          {/* Criar loja nova (que não está nos leads) */}
          <button
            onClick={() => {
              setSel({ id: 0, name: q.trim(), logo: null, isNew: true });
              setResults([]);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-brand-green-dark hover:bg-brand-green-light"
          >
            ＋ Criar nova loja &quot;{q.trim()}&quot;
          </button>
        </div>
      )}

      {sel && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            Loja: <strong>{sel.name}</strong>
            {sel.isNew && <span className="ml-2 rounded-full bg-brand-green-light px-2 py-0.5 text-[11px] font-medium text-brand-green-dark">nova</span>}
            <button onClick={() => { setSel(null); setQ(""); }} className="ml-2 text-xs text-slate-400 hover:text-red-600">
              trocar
            </button>
          </div>
          <label className="text-xs text-slate-500">
            Plano
            <select className={inp} value={planId} onChange={(e) => setPlanId(Number(e.target.value))}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Cobrança
            <select className={inp} value={interval} onChange={(e) => setInterval(e.target.value as any)}>
              <option value="monthly">Mensal — {plan ? money(plan.priceMonthly) : ""}</option>
              <option value="yearly">Anual — {plan ? money(plan.priceYearly) : ""} (−10%)</option>
            </select>
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Início
            <select className={inp} value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="trial">Começar com trial (grátis)</option>
              <option value="paid">Já pago ({money(price)}) — registra pagamento agora</option>
            </select>
          </label>
          {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
          <button
            onClick={onboard}
            disabled={busy || !planId}
            className="rounded-lg bg-brand-green px-5 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60 sm:col-span-2"
          >
            {busy ? "Cadastrando…" : "Cadastrar cliente"}
          </button>
        </div>
      )}
    </div>
  );
}
