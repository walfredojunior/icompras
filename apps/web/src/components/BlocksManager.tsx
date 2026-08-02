"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { BLOCK_ICONS, blockIcon } from "@/lib/categoryIcons";

interface Cat {
  id: number;
  slug: string;
  name: string;
  count: number;
  group: string | null;
}
interface BlockRow {
  id: number;
  title_pt: string;
  title_es: string | null;
  title_en: string | null;
  subtitle_pt: string | null;
  subtitle_es: string | null;
  subtitle_en: string | null;
  icon: string | null;
  position: number;
  active: boolean;
  categories: Array<{ id: number; slug: string; count: number }>;
}

const vazio = {
  id: 0,
  title_pt: "",
  title_es: "",
  title_en: "",
  subtitle_pt: "",
  subtitle_es: "",
  subtitle_en: "",
  icon: "tag",
  position: 0,
  active: true,
  categories: [] as number[],
};

export function BlocksManager({ blocks, categories }: { blocks: BlockRow[]; categories: Cat[] }) {
  const router = useRouter();
  const [f, setF] = useState({ ...vazio });
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q
      ? categories.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q))
      : categories;
    // Com produto primeiro — são as que vão aparecer de fato no site.
    return [...base].sort((a, b) => b.count - a.count).slice(0, 60);
  }, [categories, busca]);

  const selecionadas = f.categories;
  const totalSelecionado = categories
    .filter((c) => selecionadas.includes(c.id))
    .reduce((n, c) => n + c.count, 0);

  function alternar(id: number) {
    setF((s) => ({
      ...s,
      categories: s.categories.includes(id) ? s.categories.filter((x) => x !== id) : [...s.categories, id],
    }));
  }

  function editar(b: BlockRow) {
    setF({
      id: b.id,
      title_pt: b.title_pt ?? "",
      title_es: b.title_es ?? "",
      title_en: b.title_en ?? "",
      subtitle_pt: b.subtitle_pt ?? "",
      subtitle_es: b.subtitle_es ?? "",
      subtitle_en: b.subtitle_en ?? "",
      icon: b.icon ?? "tag",
      position: b.position ?? 0,
      active: b.active,
      categories: b.categories.map((c) => c.id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar() {
    setErr(null);
    setSaving(true);
    try {
      const r = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Não deu para salvar.");
      setF({ ...vazio });
      setBusca("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remover(id: number) {
    if (!confirm("Apagar este bloco?")) return;
    await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function alternarAtivo(b: BlockRow) {
    await fetch(`/api/admin/blocks/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !b.active }),
    });
    router.refresh();
  }

  const campo = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

  return (
    <div className="space-y-8">
      {/* Formulário */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">{f.id ? "Editar bloco" : "Novo bloco"}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Um bloco reúne várias categorias sob um tema. Ele só aparece no site quando pelo menos uma das
          categorias escolhidas tiver produto — então dá para deixar pronto antes de o robô encher.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-slate-600">Título (português) *</span>
            <input className={campo} value={f.title_pt} onChange={(e) => setF({ ...f, title_pt: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Título (espanhol)</span>
            <input className={campo} value={f.title_es} onChange={(e) => setF({ ...f, title_es: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Título (inglês)</span>
            <input className={campo} value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Descrição (português)</span>
            <input className={campo} value={f.subtitle_pt} onChange={(e) => setF({ ...f, subtitle_pt: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Descrição (espanhol)</span>
            <input className={campo} value={f.subtitle_es} onChange={(e) => setF({ ...f, subtitle_es: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Descrição (inglês)</span>
            <input className={campo} value={f.subtitle_en} onChange={(e) => setF({ ...f, subtitle_en: e.target.value })} />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="text-slate-600">Ícone</span>
            <select className={campo} value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })}>
              {BLOCK_ICONS.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Ordem</span>
            <input
              type="number"
              className={`${campo} w-24`}
              value={f.position}
              onChange={(e) => setF({ ...f, position: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
            Ativo
          </label>
        </div>

        {/* Categorias */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">
              Categorias do bloco{" "}
              <span className="font-normal text-slate-500">
                ({selecionadas.length} escolhida(s) · {totalSelecionado.toLocaleString()} produtos)
              </span>
            </span>
            <input
              placeholder="buscar categoria…"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="mt-3 flex max-h-64 flex-wrap gap-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
            {filtradas.map((c) => {
              const on = selecionadas.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternar(c.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    on
                      ? "border-brand-green bg-brand-green-light text-brand-green-dark"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                  title={c.group ? `em ${c.group}` : undefined}
                >
                  {c.name}{" "}
                  <span className={c.count ? "text-slate-400" : "text-amber-500"}>
                    {c.count ? c.count.toLocaleString() : "vazia"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Categorias marcadas como &quot;vazia&quot; podem ser escolhidas — elas aparecem sozinhas quando o robô
            trouxer produtos.
          </p>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={salvar}
            disabled={saving}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            {saving ? "Salvando…" : f.id ? "Salvar alterações" : "Criar bloco"}
          </button>
          {f.id > 0 && (
            <button
              onClick={() => setF({ ...vazio })}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-slate-300"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <h2 className="font-semibold text-slate-900">Blocos ({blocks.length})</h2>
        {blocks.length === 0 && <p className="text-sm text-slate-500">Nenhum bloco criado ainda.</p>}
        {blocks.map((b) => {
          const Icon = blockIcon(b.icon);
          const total = b.categories.reduce((n, c) => n + c.count, 0);
          return (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-green-light text-brand-green-dark">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900">
                  {b.title_pt}
                  {!b.active && <span className="ml-2 text-xs text-slate-400">(desligado)</span>}
                  {b.active && total === 0 && (
                    <span className="ml-2 text-xs text-amber-600">(sem produtos — escondido no site)</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {b.categories.length} categoria(s) · {total.toLocaleString()} produtos · ordem {b.position}
                </div>
              </div>
              <button
                onClick={() => alternarAtivo(b)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
              >
                {b.active ? "Desligar" : "Ligar"}
              </button>
              <button
                onClick={() => editar(b)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
              >
                Editar
              </button>
              <button
                onClick={() => remover(b.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                Apagar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
