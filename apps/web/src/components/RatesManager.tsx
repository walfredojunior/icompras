"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

interface Rate {
  currency: string;
  pyg_value: number;
  source: string | null;
}

export function RatesManager({ rates }: { rates: Rate[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(rates.map((r) => [r.currency, String(r.pyg_value)])),
  );
  const [busy, setBusy] = useState(false);

  async function save(currency: string) {
    await fetch("/api/admin/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency, pyg_value: Number(vals[currency]) }),
    });
    router.refresh();
  }
  async function refresh() {
    setBusy(true);
    await fetch("/api/admin/rates/refresh", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={refresh}
        disabled={busy}
        className="mb-3 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-60"
      >
        {busy ? "Atualizando…" : "Atualizar do cambioschaco"}
      </button>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Moeda</th>
              <th className="px-4 py-2 text-left font-medium">Guaraníes por 1 unidade</th>
              <th className="px-4 py-2 text-left font-medium">Fonte</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.currency} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-800">{r.currency}</td>
                <td className="px-4 py-2">
                  {r.currency === "PYG" ? (
                    <span className="text-slate-400">1</span>
                  ) : (
                    <input
                      value={vals[r.currency] ?? ""}
                      onChange={(e) => setVals((v) => ({ ...v, [r.currency]: e.target.value }))}
                      className="w-32 rounded border border-slate-300 px-2 py-1"
                    />
                  )}
                </td>
                <td className="px-4 py-2 text-slate-400">{r.source}</td>
                <td className="px-4 py-2 text-right">
                  {r.currency !== "PYG" && (
                    <button onClick={() => save(r.currency)} className="text-xs font-medium text-brand-green-dark hover:underline">
                      Salvar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
