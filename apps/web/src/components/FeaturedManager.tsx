"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

interface ProductLite {
  id: number;
  name: string;
  brand: string | null;
  slug?: string;
}

export function FeaturedManager({ featured }: { featured: ProductLite[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [searching, setSearching] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    const res = await fetch(`/api/admin/products?q=${encodeURIComponent(q)}`);
    const j = await res.json().catch(() => ({}));
    setResults(j.products ?? []);
    setSearching(false);
  }
  async function add(productId: number) {
    await fetch("/api/admin/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    setResults([]);
    setQ("");
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
              <button onClick={() => add(p.id)} className="text-xs font-medium text-brand-green-dark hover:underline">
                + destacar
              </button>
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-4 space-y-2">
        {featured.length === 0 && <li className="text-sm text-slate-500">Nenhum produto em destaque.</li>}
        {featured.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <span className="font-medium text-slate-800">{p.name}</span>
            <button onClick={() => remove(p.id)} className="text-xs text-red-500 hover:text-red-700">
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
