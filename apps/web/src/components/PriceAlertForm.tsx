"use client";

import { useState } from "react";

export interface AlertDict {
  cta: string;
  placeholder: string;
  submit: string;
  created: string;
  loginToAlert: string;
}

export function PriceAlertForm({
  productId,
  isLoggedIn,
  loginHref,
  dict,
}: {
  productId: number;
  isLoggedIn: boolean;
  loginHref: string;
  dict: AlertDict;
}) {
  const [price, setPrice] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <a href={loginHref} className="inline-block rounded-lg border border-brand-green px-4 py-2 text-sm font-medium text-brand-green-dark hover:bg-brand-green-light">
        {dict.loginToAlert}
      </a>
    );
  }

  if (done) {
    return <p className="text-sm font-medium text-brand-green-dark">✓ {dict.created}</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, targetPrice: Number(price), channel: "email" }),
    });
    if (res.ok) setDone(true);
    else setErr("Erro");
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-slate-600">{dict.cta}</span>
      <input
        type="number"
        required
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder={dict.placeholder}
        className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-green"
      />
      <button className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark">
        {dict.submit}
      </button>
      {err && <span className="text-sm text-red-600">{err}</span>}
    </form>
  );
}
