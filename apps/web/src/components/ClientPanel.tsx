"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Plan {
  id: number;
  name: string;
  priceMonthly: number;
  priceYearly: number;
}
interface Client {
  storeId: number;
  name: string;
  planId: number | null;
  interval: string;
  status: string;
  periodEnd: string | null;
}
interface KeyInfo {
  prefix: string;
  lastUsed: string | null;
}
interface Payment {
  amount: number;
  currency: string;
  method: string;
  interval: string;
  periodEnd: string | null;
  paidAt: string | null;
  note: string | null;
}

const money = (n: number, c = "USD") => (c === "USD" ? `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : `${n} ${c}`);
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export function ClientPanel({
  client,
  plans,
  keyInfo,
  payments,
  bancardEnabled,
  locale,
}: {
  client: Client;
  plans: Plan[];
  keyInfo: KeyInfo | null;
  payments: Payment[];
  bancardEnabled: boolean;
  locale: string;
}) {
  const router = useRouter();
  const id = client.storeId;
  const [planId, setPlanId] = useState(client.planId ?? plans[0]?.id ?? 0);
  const [interval, setInterval] = useState<"monthly" | "yearly">(client.interval === "yearly" ? "yearly" : "monthly");
  const [note, setNote] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [bancardUrl, setBancardUrl] = useState<string | null>(null);

  async function savePlan() {
    setBusy("plan");
    await fetch(`/api/admin/clients/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, interval }) });
    setBusy("");
    router.refresh();
  }
  async function pay() {
    setBusy("pay");
    await fetch(`/api/admin/clients/${id}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "manual", note }) });
    setBusy("");
    setNote("");
    router.refresh();
  }
  async function bancard() {
    setBusy("bancard");
    const r = await fetch(`/api/admin/clients/${id}/bancard`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      alert(j.error ?? "Não foi possível gerar o pagamento Bancard.");
      return;
    }
    const url = `/${locale}/pagar/${j.processId}`;
    setBancardUrl(url);
    window.open(url, "_blank");
  }
  async function genKey() {
    setBusy("key");
    const r = await fetch(`/api/admin/clients/${id}/apikey`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setNewKey(j.key ?? null);
    setBusy("");
    router.refresh();
  }
  async function revokeKey() {
    if (!confirm("Revogar a chave? A loja não conseguirá mais enviar preços até você gerar uma nova.")) return;
    setBusy("key");
    await fetch(`/api/admin/clients/${id}/apikey`, { method: "DELETE" });
    setNewKey(null);
    setBusy("");
    router.refresh();
  }
  async function cancelSub() {
    if (!confirm("Cancelar a assinatura deste cliente?")) return;
    setBusy("cancel");
    await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
    setBusy("");
    router.refresh();
  }

  const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-green";
  const card = "rounded-2xl border border-slate-200 bg-white p-5";

  return (
    <div className="space-y-6">
      {/* Assinatura */}
      <div className={card}>
        <h3 className="mb-3 font-semibold text-slate-900">Assinatura</h3>
        <div className="grid gap-4 sm:grid-cols-2">
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
            <select className={inp} value={interval} onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")}>
              <option value="monthly">Mensal</option>
              <option value="yearly">Anual (−10%)</option>
            </select>
          </label>
        </div>
        <button onClick={savePlan} disabled={busy === "plan"} className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-green hover:text-brand-green-dark disabled:opacity-60">
          {busy === "plan" ? "Salvando…" : "Salvar plano"}
        </button>
      </div>

      {/* Pagamento manual */}
      <div className={card}>
        <h3 className="mb-1 font-semibold text-slate-900">Registrar pagamento</h3>
        <p className="mb-3 text-xs text-slate-500">
          Empurra o vencimento (+1 {interval === "yearly" ? "ano" : "mês"} conforme a cobrança) e guarda no histórico.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (opcional): transferência, recibo nº..." />
          <button onClick={pay} disabled={busy === "pay"} className="shrink-0 rounded-lg bg-brand-green px-5 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60">
            {busy === "pay" ? "Registrando…" : "Registrar pagamento manual"}
          </button>
        </div>

        {bancardEnabled && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs text-slate-500">Ou cobre pelo cartão via Bancard (gera um link de pagamento):</p>
            <button onClick={bancard} disabled={busy === "bancard"} className="rounded-lg bg-brand-navy px-5 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-60">
              {busy === "bancard" ? "Gerando…" : "Cobrar via Bancard"}
            </button>
            {bancardUrl && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <code className="flex-1 break-all rounded bg-slate-100 px-2 py-1">{bancardUrl}</code>
                <button onClick={() => navigator.clipboard.writeText(window.location.origin + bancardUrl)} className="shrink-0 rounded bg-brand-navy px-2 py-1 font-medium text-white">
                  copiar link
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chave de API */}
      <div className={card}>
        <h3 className="mb-1 font-semibold text-slate-900">Chave de API</h3>
        <p className="mb-3 text-xs text-slate-500">A loja usa esta chave para enviar a lista de preços (header <code>Authorization: Bearer</code>).</p>

        {newKey && (
          <div className="mb-3 rounded-lg border border-brand-green/40 bg-brand-green-light p-3">
            <p className="mb-1 text-xs font-medium text-brand-green-dark">Copie agora — não será mostrada de novo:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1 text-sm">{newKey}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(newKey); setCopied(true); }}
                className="shrink-0 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-dark"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {keyInfo ? (
            <span className="text-sm text-slate-600">
              Chave ativa: <code className="rounded bg-slate-100 px-1">{keyInfo.prefix}…</code>{" "}
              <span className="text-xs text-slate-400">(último uso: {date(keyInfo.lastUsed)})</span>
            </span>
          ) : (
            <span className="text-sm text-slate-400">Nenhuma chave ativa.</span>
          )}
          <button onClick={genKey} disabled={busy === "key"} className="ml-auto rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-60">
            {busy === "key" ? "…" : keyInfo ? "Gerar nova" : "Gerar chave"}
          </button>
          {keyInfo && (
            <button onClick={revokeKey} disabled={busy === "key"} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
              Revogar
            </button>
          )}
        </div>
      </div>

      {/* Histórico */}
      {payments.length > 0 && (
        <div className={card}>
          <h3 className="mb-3 font-semibold text-slate-900">Histórico de pagamentos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400">
                <tr>
                  <th className="py-2">Data</th>
                  <th className="py-2">Valor</th>
                  <th className="py-2">Método</th>
                  <th className="py-2">Cobre até</th>
                  <th className="py-2">Obs.</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={i} className="border-t border-slate-50">
                    <td className="py-2">{date(p.paidAt)}</td>
                    <td className="py-2">{money(p.amount, p.currency)}</td>
                    <td className="py-2 capitalize">{p.method}</td>
                    <td className="py-2">{date(p.periodEnd)}</td>
                    <td className="py-2 text-xs text-slate-400">{p.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancelar */}
      <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
        <h3 className="mb-1 font-semibold text-slate-900">Cancelar assinatura</h3>
        <p className="mb-3 text-xs text-slate-500">A assinatura fica como &quot;cancelada&quot;. Você pode cadastrar novamente depois.</p>
        <button onClick={cancelSub} disabled={busy === "cancel" || client.status === "canceled"} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
          {client.status === "canceled" ? "Já cancelada" : busy === "cancel" ? "Cancelando…" : "Cancelar assinatura"}
        </button>
      </div>
    </div>
  );
}
