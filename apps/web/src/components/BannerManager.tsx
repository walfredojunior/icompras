"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

interface Cat {
  slug: string;
  name: string;
}
interface Store {
  id: number;
  name: string;
}
interface BannerRow {
  id: number;
  title: string | null;
  image_url: string;
  link_url: string | null;
  placement: string;
  category_slug: string | null;
  is_paid: number;
  active: number;
  store_id?: number | null;
  store_name?: string | null;
}

// Os campos que a edição mexe. Mesmo conjunto do formulário de criar.
interface Rascunho {
  title: string;
  link_url: string;
  image_url: string;
  placement: string;
  category_slug: string;
  store_id: string;
  is_paid: boolean;
}

export function BannerManager({
  banners,
  categories,
  stores,
}: {
  banners: BannerRow[];
  categories: Cat[];
  stores: Store[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [placement, setPlacement] = useState("home_hero");
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [isPaid, setIsPaid] = useState(false);
  const [storeId, setStoreId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movendo, setMovendo] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) setImageUrl(j.url);
    else setErr(j.error ?? "Falha no upload");
    setUploading(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) {
      setErr("Envie ou informe uma imagem.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || null,
        image_url: imageUrl,
        link_url: linkUrl || null,
        placement,
        category_slug: placement === "category" ? categorySlug : null,
        is_paid: isPaid,
        // A loja vale mesmo sem ser pago: é ela que vira o destino do clique.
        store_id: storeId ? Number(storeId) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setTitle("");
      setImageUrl("");
      setLinkUrl("");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Erro");
    }
  }

  async function toggle(id: number, active: number) {
    await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    router.refresh();
  }
  async function remove(id: number) {
    await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
    router.refresh();
  }
  // --- edição de um banner já criado -----------------------------------------
  function abrirEdicao(b: BannerRow) {
    setEditando(b.id);
    setRascunho({
      title: b.title ?? "",
      link_url: b.link_url ?? "",
      image_url: b.image_url,
      placement: b.placement,
      category_slug: b.category_slug ?? categories[0]?.slug ?? "",
      store_id: b.store_id ? String(b.store_id) : "",
      is_paid: !!b.is_paid,
    });
    setErr(null);
  }

  async function trocarImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !rascunho) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) setRascunho({ ...rascunho, image_url: j.url });
    else setErr(j.error ?? "Falha no upload");
    setUploading(false);
  }

  async function salvarEdicao(id: number) {
    if (!rascunho) return;
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edit: rascunho }),
    });
    setSaving(false);
    if (res.ok) {
      setEditando(null);
      setRascunho(null);
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Erro ao salvar");
    }
  }

  async function mover(id: number, move: "up" | "down") {
    setMovendo(id);
    await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move }),
    });
    router.refresh();
    setMovendo(null);
  }

  // A ordem só faz sentido dentro do mesmo espaço: o banner do topo da home não
  // disputa lugar com o de uma categoria. Aqui descubro, para cada linha, se ela
  // é a primeira ou a última do seu grupo — é o que desliga a setinha na ponta.
  const chave = (b: BannerRow) => `${b.placement}|${b.category_slug ?? ""}`;
  const posicaoNoGrupo = new Map<number, { primeiro: boolean; ultimo: boolean }>();
  {
    const porGrupo = new Map<string, BannerRow[]>();
    for (const b of banners) {
      const k = chave(b);
      if (!porGrupo.has(k)) porGrupo.set(k, []);
      porGrupo.get(k)!.push(b);
    }
    for (const lista of porGrupo.values()) {
      lista.forEach((b, i) =>
        posicaoNoGrupo.set(b.id, { primeiro: i === 0, ultimo: i === lista.length - 1 }),
      );
    }
  }

  return (
    <div>
      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Link ao clicar (opcional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />

        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-600">Imagem</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input type="file" accept="image/*" onChange={onFile} className="text-sm" />
            {uploading && <span className="text-xs text-slate-400">enviando…</span>}
            <span className="text-xs text-slate-400">ou cole uma URL:</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="/media/... ou https://..." className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="mt-2 h-20 rounded object-cover" />
          )}
        </div>

        <label className="text-sm text-slate-600">
          Onde aparece
          <select value={placement} onChange={(e) => setPlacement(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="home_hero">Topo da home (carrossel)</option>
            <option value="category">Topo de uma categoria</option>
          </select>
        </label>

        {placement === "category" && (
          <label className="text-sm text-slate-600">
            Categoria
            <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

        {/* A loja NÃO depende mais de ser publicidade paga. Um banner pode ser
            simplesmente de uma loja do site, sem dinheiro envolvido — e é
            justamente aí que a loja serve de destino do clique. */}
        <label className="text-sm text-slate-600">
          Loja deste banner (opcional)
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">— nenhuma —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-400">
            Sem link acima, o clique leva para a página desta loja no iCompras. Sem link e sem loja, o
            banner não é clicável.
          </span>
        </label>

        <label className="flex items-center gap-2 self-end text-sm text-slate-600">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
          É publicidade paga
        </label>

        {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2">
          <button disabled={saving} className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60">
            {saving ? "Salvando…" : "Criar banner"}
          </button>
        </div>
      </form>

      <p className="mt-5 text-xs text-slate-400">
        A ordem da lista é a ordem em que os banners passam no carrossel. Use as setas para mudar.
      </p>
      <ul className="mt-2 space-y-2">
        {banners.length === 0 && <li className="text-sm text-slate-500">Nenhum banner ainda.</li>}
        {banners.map((b) => {
          const pos = posicaoNoGrupo.get(b.id) ?? { primeiro: true, ultimo: true };
          const setaCls =
            "flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:border-brand-green hover:text-brand-green-dark disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300";
          // Editando: a linha vira formulário no lugar, sem janela flutuante.
          // Em janela o painel fica ruim no celular — a pessoa perde a
          // referência de qual banner está mexendo.
          if (editando === b.id && rascunho) {
            const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
            return (
              <li key={b.id} className="rounded-xl border-2 border-brand-green bg-brand-green-light/20 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-green-dark">
                  Editando banner
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Título
                    <input value={rascunho.title} onChange={(e) => setRascunho({ ...rascunho, title: e.target.value })} className={`mt-1 block w-full ${campo}`} />
                  </label>
                  <label className="text-sm text-slate-600">
                    Link ao clicar
                    <input value={rascunho.link_url} onChange={(e) => setRascunho({ ...rascunho, link_url: e.target.value })} placeholder="deixe vazio para usar a loja" className={`mt-1 block w-full ${campo}`} />
                  </label>

                  <div className="sm:col-span-2">
                    <label className="block text-sm text-slate-600">Imagem</label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rascunho.image_url} alt="" className="h-14 w-24 rounded object-cover" />
                      <input type="file" accept="image/*" onChange={trocarImagem} className="text-sm" />
                      {uploading && <span className="text-xs text-slate-400">enviando…</span>}
                    </div>
                  </div>

                  <label className="text-sm text-slate-600">
                    Onde aparece
                    <select value={rascunho.placement} onChange={(e) => setRascunho({ ...rascunho, placement: e.target.value })} className={`mt-1 block w-full ${campo}`}>
                      <option value="home_hero">Topo da home (carrossel)</option>
                      <option value="category">Topo de uma categoria</option>
                    </select>
                  </label>
                  {rascunho.placement === "category" && (
                    <label className="text-sm text-slate-600">
                      Categoria
                      <select value={rascunho.category_slug} onChange={(e) => setRascunho({ ...rascunho, category_slug: e.target.value })} className={`mt-1 block w-full ${campo}`}>
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="text-sm text-slate-600">
                    Loja deste banner
                    <select value={rascunho.store_id} onChange={(e) => setRascunho({ ...rascunho, store_id: e.target.value })} className={`mt-1 block w-full ${campo}`}>
                      <option value="">— nenhuma —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 self-end text-sm text-slate-600">
                    <input type="checkbox" checked={rascunho.is_paid} onChange={(e) => setRascunho({ ...rascunho, is_paid: e.target.checked })} />
                    É publicidade paga
                  </label>

                  {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
                  <div className="flex gap-2 sm:col-span-2">
                    <button onClick={() => salvarEdicao(b.id)} disabled={saving} className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60">
                      {saving ? "Salvando…" : "Salvar"}
                    </button>
                    <button onClick={() => { setEditando(null); setRascunho(null); setErr(null); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              </li>
            );
          }

          return (
            <li key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              {/* Setas empilhadas em vez de arrastar: no celular arrastar item de
                  lista é impreciso, e o painel é usado bastante pelo telefone. */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => mover(b.id, "up")}
                  disabled={pos.primeiro || movendo === b.id}
                  title="Subir"
                  aria-label="Subir"
                  className={setaCls}
                >
                  ↑
                </button>
                <button
                  onClick={() => mover(b.id, "down")}
                  disabled={pos.ultimo || movendo === b.id}
                  title="Descer"
                  aria-label="Descer"
                  className={setaCls}
                >
                  ↓
                </button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image_url} alt="" className="h-12 w-20 rounded object-cover" />
              <div className="flex-1 text-sm">
                <div className="font-medium text-slate-800">{b.title || "(sem título)"}</div>
                <div className="text-xs text-slate-400">
                  {b.placement === "category" ? `Categoria: ${b.category_slug}` : "Topo da home"}
                  {b.store_name ? ` · ${b.store_name}` : ""}
                  {b.is_paid ? " · Pago" : ""}
                  {b.active ? "" : " · inativo"}
                </div>
                {/* Para onde o clique leva, escrito por extenso: é a dúvida que
                    mais aparece depois que a regra virou automática. */}
                <div className="mt-0.5 text-xs text-slate-400">
                  {b.link_url
                    ? `→ ${b.link_url}`
                    : b.store_name
                      ? `→ página da loja ${b.store_name} no iCompras`
                      : "→ sem clique"}
                </div>
              </div>
              <button onClick={() => abrirEdicao(b)} className="text-xs font-medium text-brand-green-dark hover:underline">
                Editar
              </button>
              <button onClick={() => toggle(b.id, b.active)} className="text-xs text-slate-500 hover:text-slate-800">
                {b.active ? "Desativar" : "Ativar"}
              </button>
              <button onClick={() => remove(b.id)} className="text-xs text-red-500 hover:text-red-700">
                Excluir
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
