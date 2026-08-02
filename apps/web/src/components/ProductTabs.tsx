"use client";

import { useState } from "react";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";

export function ProductTabs({
  specs,
  history,
  locale,
  labels,
}: {
  specs: Array<{ k: string; v: string }>;
  history: Array<{ day: string; usd: number }>;
  locale: string;
  labels: { specifications: string; priceHistory: string; noHistory: string; lowestPrice: string };
}) {
  const [tab, setTab] = useState<"specs" | "history">("specs");

  const tabBtn = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition ${
      active ? "border-brand-green text-brand-navy" : "border-transparent text-slate-500 hover:text-slate-800"
    }`;

  return (
    <div className="mt-10">
      <div className="flex gap-2 border-b border-slate-200">
        <button className={tabBtn(tab === "specs")} onClick={() => setTab("specs")}>
          {labels.specifications}
        </button>
        <button className={tabBtn(tab === "history")} onClick={() => setTab("history")}>
          {labels.priceHistory}
        </button>
      </div>

      <div className="pt-5">
        {tab === "specs" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <tbody>
                {specs.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100 first:border-t-0">
                    <td className="w-40 bg-slate-50 px-4 py-2.5 font-medium text-slate-600">{s.k}</td>
                    <td className="px-4 py-2.5 text-slate-800">{s.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : history.length >= 2 ? (
          <PriceHistoryChart data={history} locale={locale} lowestLabel={labels.lowestPrice} />
        ) : (
          <p className="text-slate-500">{labels.noHistory}</p>
        )}
      </div>
    </div>
  );
}
