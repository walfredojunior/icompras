import { fromUsd, fmt } from "@/lib/money";
import type { Rates } from "@/lib/rates";

// Preço com o dólar em destaque e Real/Guarani menores embaixo.
export function MoneyStack({
  usd,
  rates,
  locale,
  size = "md",
}: {
  usd: number | null;
  rates: Rates;
  locale: string;
  size?: "sm" | "md" | "lg";
}) {
  if (usd == null) return <span className="text-slate-400">—</span>;
  const m = fromUsd(usd, rates);
  const usdCls =
    size === "lg"
      ? "text-3xl font-bold text-brand-green-dark"
      : size === "sm"
        ? "text-sm font-bold text-brand-green-dark"
        : "text-lg font-bold text-brand-green-dark";

  return (
    <div>
      <div className={usdCls}>{fmt(m.usd, "USD", locale)}</div>
      <div className="text-xs text-slate-400">{fmt(m.brl, "BRL", locale)}</div>
      <div className="text-xs text-slate-400">{fmt(m.pyg, "PYG", locale)}</div>
    </div>
  );
}
