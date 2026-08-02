import { fmt } from "@/lib/money";

export function PriceHistoryChart({
  data,
  locale,
  lowestLabel,
}: {
  data: Array<{ day: string; usd: number }>;
  locale: string;
  lowestLabel: string;
}) {
  const w = 600;
  const h = 180;
  const pad = 24;
  const values = data.map((d) => d.usd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const x = (i: number) => pad + (data.length === 1 ? (w - 2 * pad) / 2 : (i / (data.length - 1)) * (w - 2 * pad));
  const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);
  const points = data.map((d, i) => `${x(i)},${y(d.usd)}`).join(" ");
  const last = data[data.length - 1]?.usd ?? 0;

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        {lowestLabel}: <span className="font-bold text-brand-green-dark">{fmt(min, "USD", locale)}</span>
      </p>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[380px]" role="img">
          <polyline fill="none" stroke="#2fa043" strokeWidth="2.5" points={points} />
          {data.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d.usd)} r="3.5" fill="#123a5e" />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>{data[0]?.day}</span>
        <span>
          {data[data.length - 1]?.day} — {fmt(last, "USD", locale)}
        </span>
      </div>
    </div>
  );
}
