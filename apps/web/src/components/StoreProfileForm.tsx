"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  name: string;
  slug: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  mapsQuery: string | null;
  selfManaged: boolean;
}

export function StoreProfileForm({ storeId, profile, locale }: { storeId: number; profile: Profile; locale: string }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: profile.name ?? "",
    logoUrl: profile.logoUrl ?? "",
    address: profile.address ?? "",
    city: profile.city ?? "",
    phone: profile.phone ?? "",
    website: profile.website ?? "",
    description: profile.description ?? "",
    mapsQuery: profile.mapsQuery ?? "",
    selfManaged: profile.selfManaged,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function uploadLogo(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (j.url) setF((p) => ({ ...p, logoUrl: j.url }));
    setUploading(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch(`/api/admin/clients/${storeId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  const inp = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-green";

  return (
    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Dados da loja</h3>
        <a href={`/${locale}/loja/${profile.slug}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-brand-navy hover:underline">
          ver página pública →
        </a>
      </div>

      {/* Logo */}
      <div className="mb-4 flex items-center gap-4">
        {f.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.logoUrl} alt="logo" className="h-16 w-16 rounded-lg border border-slate-200 object-contain" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-400">
            {f.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-green">
            {uploading ? "Enviando…" : "Trocar logo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          </label>
          {f.logoUrl && (
            <button type="button" onClick={() => setF({ ...f, logoUrl: "" })} className="ml-2 text-xs text-slate-400 hover:text-red-600">
              remover
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-slate-500 sm:col-span-2">
          Nome da loja
          <input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <label className="text-xs text-slate-500">
          Endereço
          <input className={inp} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Av. ..., nº" />
        </label>
        <label className="text-xs text-slate-500">
          Cidade
          <input className={inp} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Ciudad del Este" />
        </label>
        <label className="text-xs text-slate-500">
          Telefone / WhatsApp
          <input className={inp} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="595..." />
        </label>
        <label className="text-xs text-slate-500">
          Site
          <input className={inp} value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://..." />
        </label>
        <label className="text-xs text-slate-500 sm:col-span-2">
          Localização no mapa (endereço/nome para o Google Maps)
          <input className={inp} value={f.mapsQuery} onChange={(e) => setF({ ...f, mapsQuery: e.target.value })} placeholder="Nome da loja, Cidade, Paraguay" />
        </label>
        <label className="text-xs text-slate-500 sm:col-span-2">
          Descrição
          <textarea className={inp} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </label>
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <input type="checkbox" checked={f.selfManaged} onChange={(e) => setF({ ...f, selfManaged: e.target.checked })} className="mt-0.5" />
        <span>
          <strong>Este cliente envia a própria lista de preços</strong> (via API).
          <span className="block text-xs text-slate-500">Quando marcado, o scraper deixa de coletar os dados/preços desta loja. Desmarque durante a transição, se ainda quiser usar os dados do scraper.</span>
        </span>
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button disabled={saving} className="rounded-lg bg-brand-green px-5 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60">
          {saving ? "Salvando…" : "Salvar dados da loja"}
        </button>
        {saved && <span className="text-sm text-brand-green-dark">Salvo ✓</span>}
      </div>
    </form>
  );
}
