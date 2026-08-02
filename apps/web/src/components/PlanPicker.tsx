"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/format";

export interface PlanRow {
  id: number;
  name: string;
  price_monthly: number;
  currency: string;
  max_products: number;
}

export function PlanPicker({
  plans,
  currentPlanId,
  locale,
  dict,
}: {
  plans: PlanRow[];
  currentPlanId: number | null;
  locale: string;
  dict: { subscribe: string; current: string; unlimited: string; productsLabel: string; perMonth: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function subscribe(planId: number) {
    setBusy(planId);
    const res = await fetch("/api/store/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
    else {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Erro");
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((p) => {
        const isCurrent = p.id === currentPlanId;
        return (
          <div
            key={p.id}
            className={`rounded-2xl border p-5 ${isCurrent ? "border-brand-green bg-brand-green-light" : "border-slate-200"}`}
          >
            <h3 className="font-semibold text-slate-900">{p.name}</h3>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {p.price_monthly > 0 ? formatPrice(Number(p.price_monthly), p.currency, locale) : "₲0"}
              <span className="text-sm font-normal text-slate-400"> /{dict.perMonth}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {p.max_products > 0 ? `${p.max_products} ${dict.productsLabel}` : dict.unlimited}
            </p>
            <button
              onClick={() => subscribe(p.id)}
              disabled={isCurrent || busy === p.id}
              className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium ${
                isCurrent
                  ? "cursor-default bg-brand-green text-white"
                  : "bg-brand-navy text-white hover:bg-brand-navy-dark disabled:opacity-60"
              }`}
            >
              {isCurrent ? dict.current : dict.subscribe}
            </button>
          </div>
        );
      })}
    </div>
  );
}
