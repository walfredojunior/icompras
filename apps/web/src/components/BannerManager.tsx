"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { tipoEquivalente, type DestinoTipo } from "@/lib/bannerDestino";

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
  destino_tipo: string | null;
  busca: string | null;
  placement: string;
  category_slug: string | null;
  is_paid: number;
  active: number;
  store_id?: number | null;
  store_name?: string | null;
  store_slug?: string | null;
  cliques30?: number;
}

// Os campos que o formulário mexe. Mesmo conjunto para criar e para editar.
interface Rascunho {
  title: string;
  link_url: string;
  destino_tipo: DestinoTipo;
  busca: string;
  image_url: string;
  placement: string;
  category_slug: string;
  store_id: string;
  is_paid: boolean;
}

const ROTULOS: Record<DestinoTipo, string> = {
  busca: "Busca pronta (uma frase)",
  marca: "Todos os produtos de uma marca",
  loja: "Página de uma loja no iCompras",
  link: "Endereço externo (site do anunciante)",
  nenhum: "Nenhum — só imagem, sem clique",
  auto: "Modo antigo (link, senão loja)",
};

const ID_LISTA_MARCAS = "marcas-do-catalogo";

// Quantos produtos essa busca acha agora.
//
// Sem isto, o único jeito de descobrir que um banner leva a uma página vazia
// era publicar e reparar depois. Espera 400ms de silêncio para não disparar uma
// consulta por letra digitada.
function PreviaBusca({ tipo, valor }: { tipo: DestinoTipo; valor: string }) {
  const [total, setTotal] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const termo = valor.trim();
    if (!termo) {
      setTotal(null);
      return;
    }
    setCarregando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/admin/banners/previa?tipo=${tipo}&valor=${encodeURIComponent(termo)}`,
        );
        const j = await r.json();
        setTotal(typeof j.total === "number" ? j.total : null);
      } catch {
        setTotal(null);
      }
      setCarregando(false);
    }, 400);
    return () => clearTimeout(t);
  }, [tipo, valor]);

  if (!valor.trim()) return null;
  if (carregando) return <span className="text-xs text-slate-400">conferindo…</span>;
  if (total === null) return null;
  if (total === 0) {
    return (
      <span className="text-xs font-medium text-red-600">
        nenhum produto encontrado — o banner levaria a uma página vazia
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-brand-green-dark">
      encontra {total.toLocaleString("pt-BR")} produto{total === 1 ? "" : "s"}
    </span>
  );
}

// O bloco "para onde o clique leva", igual nos dois formulários.
function CamposDeDestino({
  d,
  set,
  stores,
}: {
  d: Rascunho;
  set: (r: Rascunho) => void;
  stores: Store[];
}) {
  const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  const tipo = d.destino_tipo;

  return (
    <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label className="text-sm font-medium text-slate-700">
        Para onde o clique leva?
        <select
          value={tipo}
          onChange={(e) => set({ ...d, destino_tipo: e.target.value as DestinoTipo })}
          className={`mt-1 block w-full ${campo}`}
        >
          {(["busca", "marca", "loja", "link", "nenhum"] as DestinoTipo[]).map((t) => (
            <option key={t} value={t}>
              {ROTULOS[t]}
            </option>
          ))}
        </select>
      </label>

      {tipo === "busca" && (
        <div className="mt-2">
          <input
            value={d.busca}
            onChange={(e) => set({ ...d, busca: e.target.value })}
            placeholder="o que procurar — ex.: perfume masculino"
            className={`block w-full ${campo}`}
          />
          <div className="mt-1 flex items-center gap-2">
            <PreviaBusca tipo="busca" valor={d.busca} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Abre a busca do site já preenchida. Boa para frases: “iphone 17 pro”, “perfume
            importado”.
          </p>
        </div>
      )}

      {tipo === "marca" && (
        <div className="mt-2">
          <input
            value={d.busca}
            onChange={(e) => set({ ...d, busca: e.target.value })}
            list={ID_LISTA_MARCAS}
            placeholder="comece a digitar a marca — ex.: Apple"
            className={`block w-full ${campo}`}
          />
          <div className="mt-1 flex items-center gap-2">
            <PreviaBusca tipo="marca" valor={d.busca} />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Traz <strong>exatamente</strong> os produtos da marca — mais preciso que a frase, que
            também pegaria capinhas “para Apple”. Escolha um nome da lista: o texto tem que bater
            com o do catálogo.
          </p>
        </div>
      )}

      {tipo === "loja" && (
        <p className="mt-2 text-xs text-slate-500">
          Vai para a página da loja escolhida em <strong>“Loja deste banner”</strong>, aqui embaixo.
          {!d.store_id && <span className="font-medium text-red-600"> Escolha uma loja.</span>}
        </p>
      )}

      {tipo === "link" && (
        <div className="mt-2">
          <input
            value={d.link_url}
            onChange={(e) => set({ ...d, link_url: e.target.value })}
            placeholder="https://site-do-anunciante.com"
            className={`block w-full ${campo}`}
          />
          <p className="mt-1 text-xs text-slate-400">Sai do iCompras: abre numa aba nova.</p>
        </div>
      )}

      {tipo === "nenhum" && (
        <p className="mt-2 text-xs text-slate-400">O banner aparece, mas não é clicável.</p>
      )}

      <label className="mt-3 block text-sm text-slate-600">
        Loja deste banner (opcional)
        <select
          value={d.store_id}
          onChange={(e) => set({ ...d, store_id: e.target.value })}
          className={`mt-1 block w-full ${campo}`}
        >
          <option value="">— nenhuma —</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-slate-400">
          Identifica o anunciante nos relatórios. É também o destino quando a opção acima é “página
          de uma loja”.
        </span>
      </label>
    </div>
  );
}

// Como a linha da lista descreve o destino, por extenso.
function descreverDestino(b: BannerRow): string {
  switch ((b.destino_tipo ?? "auto") as DestinoTipo) {
    case "busca":
      return `→ busca por «${b.busca}»`;
    case "marca":
      return `→ todos os produtos da marca ${b.busca}`;
    case "loja":
      return b.store_name ? `→ página da loja ${b.store_name}` : "→ loja não escolhida (sem clique)";
    case "link":
      return `→ ${b.link_url}`;
    case "nenhum":
      return "→ sem clique";
    default:
      // Cadastrado antes desta tela: o destino ainda é o adivinhado.
      return b.link_url
        ? `→ ${b.link_url} (modo antigo)`
        : b.store_name
          ? `→ página da loja ${b.store_name} (modo antigo)`
          : "→ sem clique (modo antigo)";
  }
}

const VAZIO: Rascunho = {
  title: "",
  link_url: "",
  destino_tipo: "busca",
  busca: "",
  image_url: "",
  placement: "home_hero",
  category_slug: "",
  store_id: "",
  is_paid: false,
};

export function BannerManager({
  banners,
  categories,
  stores,
  marcas,
}: {
  banners: BannerRow[];
  categories: Cat[];
  stores: Store[];
  marcas: string[];
}) {
  const router = useRouter();
  const [novo, setNovo] = useState<Rascunho>({
    ...VAZIO,
    category_slug: categories[0]?.slug ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movendo, setMovendo] = useState<number | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function enviarImagem(file: File): Promise<string | null> {
    setUploading(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setUploading(false);
    if (res.ok && j.url) return j.url as string;
    setErr(j.error ?? "Falha no upload");
    return null;
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await enviarImagem(file);
    if (url) setNovo((n) => ({ ...n, image_url: url }));
  }

  // Mesma checagem que a API faz, só que antes de mandar — assim o erro
  // aparece no campo e não como mensagem depois de salvar.
  function faltando(d: Rascunho): string | null {
    if (!d.image_url) return "Envie ou informe uma imagem.";
    if ((d.destino_tipo === "busca" || d.destino_tipo === "marca") && !d.busca.trim())
      return "Escreva o que a busca deve procurar.";
    if (d.destino_tipo === "loja" && !d.store_id) return "Escolha a loja de destino.";
    if (d.destino_tipo === "link" && !d.link_url.trim()) return "Informe o endereço do link.";
    return null;
  }

  function corpo(d: Rascunho) {
    return {
      title: d.title || null,
      image_url: d.image_url,
      link_url: d.link_url || null,
      destino_tipo: d.destino_tipo,
      busca: d.busca || null,
      placement: d.placement,
      category_slug: d.placement === "category" ? d.category_slug : null,
      is_paid: d.is_paid,
      store_id: d.store_id ? Number(d.store_id) : null,
    };
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const problema = faltando(novo);
    if (problema) {
      setErr(problema);
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/admin/banners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo(novo)),
    });
    setSaving(false);
    if (res.ok) {
      setNovo({ ...VAZIO, category_slug: categories[0]?.slug ?? "" });
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
      // Banner antigo abre já na opção equivalente à que ele usa hoje: salvar
      // o converte para o modo explícito, sem mudar para onde ele leva.
      destino_tipo: tipoEquivalente(b),
      busca: b.busca ?? "",
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
    const url = await enviarImagem(file);
    if (url) setRascunho({ ...rascunho, image_url: url });
  }

  async function salvarEdicao(id: number) {
    if (!rascunho) return;
    const problema = faltando(rascunho);
    if (problema) {
      setErr(problema);
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await fetch(`/api/admin/banners/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edit: corpo(rascunho) }),
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

  const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  return (
    <div>
      {/* Lista de marcas do catálogo, usada pelos dois formulários. O navegador
          sugere sozinho enquanto se digita — com centenas de marcas, uma caixa
          de seleção comum seria impossível de percorrer no celular. */}
      <datalist id={ID_LISTA_MARCAS}>
        {marcas.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
        <input
          value={novo.title}
          onChange={(e) => setNovo({ ...novo, title: e.target.value })}
          placeholder="Título (opcional)"
          className={campo}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={novo.is_paid}
            onChange={(e) => setNovo({ ...novo, is_paid: e.target.checked })}
          />
          É publicidade paga
        </label>

        <div className="sm:col-span-2">
          <label className="block text-sm text-slate-600">Imagem</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input type="file" accept="image/*" onChange={onFile} className="text-sm" />
            {uploading && <span className="text-xs text-slate-400">enviando…</span>}
            <span className="text-xs text-slate-400">ou cole uma URL:</span>
            <input
              value={novo.image_url}
              onChange={(e) => setNovo({ ...novo, image_url: e.target.value })}
              placeholder="/media/... ou https://..."
              className={`flex-1 ${campo}`}
            />
          </div>
          {novo.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={novo.image_url} alt="" className="mt-2 h-20 rounded object-cover" />
          )}
        </div>

        <CamposDeDestino d={novo} set={setNovo} stores={stores} />

        <label className="text-sm text-slate-600">
          Onde aparece
          <select
            value={novo.placement}
            onChange={(e) => setNovo({ ...novo, placement: e.target.value })}
            className={`mt-1 block w-full ${campo}`}
          >
            <option value="home_hero">Topo da home (carrossel)</option>
            <option value="category">Topo de uma categoria</option>
          </select>
        </label>

        {novo.placement === "category" && (
          <label className="text-sm text-slate-600">
            Categoria
            <select
              value={novo.category_slug}
              onChange={(e) => setNovo({ ...novo, category_slug: e.target.value })}
              className={`mt-1 block w-full ${campo}`}
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {err && !editando && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        <div className="sm:col-span-2">
          <button
            disabled={saving}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Criar banner"}
          </button>
        </div>
      </form>

      <p className="mt-5 text-xs text-slate-400">
        A ordem da lista é a ordem em que os banners passam no carrossel. Use as setas para mudar.
        Os cliques são dos últimos 30 dias.
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
            return (
              <li key={b.id} className="rounded-xl border-2 border-brand-green bg-brand-green-light/20 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-green-dark">
                  Editando banner
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Título
                    <input
                      value={rascunho.title}
                      onChange={(e) => setRascunho({ ...rascunho, title: e.target.value })}
                      className={`mt-1 block w-full ${campo}`}
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rascunho.is_paid}
                      onChange={(e) => setRascunho({ ...rascunho, is_paid: e.target.checked })}
                    />
                    É publicidade paga
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

                  <CamposDeDestino d={rascunho} set={setRascunho} stores={stores} />

                  <label className="text-sm text-slate-600">
                    Onde aparece
                    <select
                      value={rascunho.placement}
                      onChange={(e) => setRascunho({ ...rascunho, placement: e.target.value })}
                      className={`mt-1 block w-full ${campo}`}
                    >
                      <option value="home_hero">Topo da home (carrossel)</option>
                      <option value="category">Topo de uma categoria</option>
                    </select>
                  </label>
                  {rascunho.placement === "category" && (
                    <label className="text-sm text-slate-600">
                      Categoria
                      <select
                        value={rascunho.category_slug}
                        onChange={(e) => setRascunho({ ...rascunho, category_slug: e.target.value })}
                        className={`mt-1 block w-full ${campo}`}
                      >
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {err && <p className="text-sm text-red-600 sm:col-span-2">{err}</p>}
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      onClick={() => salvarEdicao(b.id)}
                      disabled={saving}
                      className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
                    >
                      {saving ? "Salvando…" : "Salvar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditando(null);
                        setRascunho(null);
                        setErr(null);
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
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
                <div className="mt-0.5 text-xs text-slate-400">{descreverDestino(b)}</div>
              </div>
              {/* O número que o anunciante pede na hora de renovar. */}
              <div className="w-16 text-center">
                <div className="text-sm font-semibold text-brand-navy">{b.cliques30 ?? 0}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">cliques</div>
              </div>
              <button
                onClick={() => abrirEdicao(b)}
                className="text-xs font-medium text-brand-green-dark hover:underline"
              >
                Editar
              </button>
              <button
                onClick={() => toggle(b.id, b.active)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
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
