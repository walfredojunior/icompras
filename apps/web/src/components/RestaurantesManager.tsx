"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Plus, Star, Trash2, Search, X } from "lucide-react";
import {
  CamposDeVenda,
  VENDA_VAZIA,
  type DadosDaVenda,
  type LinhaDePrecoLite,
} from "./CamposDeVenda";

// CADASTRO DO GUIA "ONDE COMER" (22/08/2026).
//
// ⚠ A FICHA TEM CAMPOS DE VERDADE, não é mais um banner com o texto desenhado
// dentro da imagem. É o que permite filtrar por cidade e por tipo — e é o que o
// Google lê, já que ele não enxerga texto dentro de foto.
//
// 💡 SEM PREÇO E SEM HORÁRIO, decisão dele e concordo: os dois mudam o tempo
// todo e ninguém teria como manter. Valor errado no site vira reclamação contra
// o iCompras — a pessoa viaja, chega lá e o almoço custa o dobro.

interface Rest {
  id: number;
  nome: string;
  cidade: string;
  tipo: string;
  link: string | null;
  whatsapp: string | null;
  endereco: string | null;
  descricao: string | null;
  foto_url: string | null;
  destaque: number;
  is_paid: number;
  active: number;
  store_name?: string | null;
  store_id?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  pedido_numero?: string | null;
}

const VAZIO = {
  id: 0,
  nome: "",
  cidade: "",
  tipo: "outros",
  link: "",
  whatsapp: "",
  endereco: "",
  descricao: "",
  foto_url: "",
  destaque: false,
  active: true,
};

const dia = (s: string | null | undefined) =>
  s ? String(s).slice(0, 10).split("-").reverse().join("/") : "";

export function RestaurantesManager({
  restaurantes,
  tipos,
  stores,
  precos,
}: {
  restaurantes: Rest[];
  tipos: Array<{ id: string; rotulo: string }>;
  stores: Array<{ id: number; name: string; ehCliente?: boolean }>;
  precos: LinhaDePrecoLite[];
}) {
  const router = useRouter();
  const [f, setF] = useState({ ...VAZIO });
  const [venda, setVenda] = useState<DadosDaVenda>(VENDA_VAZIA);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  async function enviarFoto(file: File) {
    setEnviando(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", file);
    // A foto do restaurante usa o formato padrão (paisagem), não a faixa fina.
    fd.append("formato", "padrao");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    setEnviando(false);
    if (res.ok && j.url) setF((x) => ({ ...x, foto_url: j.url }));
    else setErr(j.error ?? "Falha ao enviar a foto.");
  }

  async function salvar() {
    if (!f.nome.trim()) return setErr("Escreva o nome do restaurante.");
    if (!f.cidade.trim()) return setErr("Escreva a cidade.");
    setSalvando(true);
    setErr(null);
    const res = await fetch("/api/admin/restaurantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...f,
        store_id: venda.store_id || null,
        is_paid: venda.is_paid,
        starts_at: venda.starts_at || null,
        ends_at: venda.ends_at || null,
        valor: venda.valor ? Number(venda.valor) : null,
        duracao: venda.duracao,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) return setErr(j.error ?? "Não deu certo.");
    setF({ ...VAZIO });
    setVenda(VENDA_VAZIA);
    setCriando(false);
    router.refresh();
  }

  async function apagar(id: number) {
    await fetch(`/api/admin/restaurantes?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  function editar(r: Rest) {
    setF({
      id: r.id,
      nome: r.nome,
      cidade: r.cidade,
      tipo: r.tipo,
      link: r.link ?? "",
      whatsapp: r.whatsapp ?? "",
      endereco: r.endereco ?? "",
      descricao: r.descricao ?? "",
      foto_url: r.foto_url ?? "",
      destaque: r.destaque === 1,
      active: r.active === 1,
    });
    setVenda({
      ...VENDA_VAZIA,
      store_id: r.store_id ? String(r.store_id) : "",
      is_paid: r.is_paid === 1,
      starts_at: r.starts_at ? String(r.starts_at).slice(0, 10) : "",
      ends_at: r.ends_at ? String(r.ends_at).slice(0, 10) : "",
      // Em branco: o que já foi cobrado está no item de venda, e reescrever aqui
      // mudaria o passado.
      valor: "",
    });
    setCriando(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const visiveis = restaurantes.filter((r) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return (
      r.nome.toLowerCase().includes(q) ||
      r.cidade.toLowerCase().includes(q) ||
      (r.store_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {!criando && (
        <button
          onClick={() => setCriando(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark"
        >
          <Plus className="h-4 w-4" /> Novo restaurante
        </button>
      )}

      {criando && (
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              {f.id ? `Editando: ${f.nome}` : "Novo restaurante"}
            </h2>
            <button
              onClick={() => {
                setCriando(false);
                setF({ ...VAZIO });
                setVenda(VENDA_VAZIA);
                setErr(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              cancelar
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-600">
              Nome *
              <input
                value={f.nome}
                onChange={(e) => setF({ ...f, nome: e.target.value })}
                placeholder="Churrascaria Fogo Gaúcho"
                className={`mt-1 block w-full ${campo}`}
              />
            </label>
            <label className="text-sm text-slate-600">
              Cidade *
              <input
                value={f.cidade}
                onChange={(e) => setF({ ...f, cidade: e.target.value })}
                placeholder="Ciudad del Este"
                list="cidades-restaurantes"
                className={`mt-1 block w-full ${campo}`}
              />
              {/* Sugere as cidades já usadas: evita "Ciudad del Este" e "ciudad
                  del este" virarem dois filtros diferentes. */}
              <datalist id="cidades-restaurantes">
                {[...new Set(restaurantes.map((r) => r.cidade))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="text-sm text-slate-600">
              Tipo de comida
              <select
                value={f.tipo}
                onChange={(e) => setF({ ...f, tipo: e.target.value })}
                className={`mt-1 block w-full ${campo}`}
              >
                {tipos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.rotulo}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600">
              Endereço (opcional)
              <input
                value={f.endereco}
                onChange={(e) => setF({ ...f, endereco: e.target.value })}
                placeholder="Av. San Blas, 1250"
                className={`mt-1 block w-full ${campo}`}
              />
            </label>

            <label className="text-sm text-slate-600">
              Link (Instagram, Facebook ou site)
              <input
                value={f.link}
                onChange={(e) => setF({ ...f, link: e.target.value })}
                placeholder="instagram.com/nome-do-restaurante"
                className={`mt-1 block w-full ${campo}`}
              />
              {/* O site reconhece sozinho o que foi colado e mostra o botão
                  certo — ele avisou que restaurante quase nunca tem site. */}
              <span className="mt-1 block text-xs text-slate-400">
                Cole o endereço que tiver — o site reconhece e mostra o botão certo.
              </span>
            </label>

            <label className="text-sm text-slate-600">
              WhatsApp (opcional)
              <input
                value={f.whatsapp}
                onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
                placeholder="+595 99 123-4567"
                className={`mt-1 block w-full ${campo}`}
              />
            </label>

            <label className="text-sm text-slate-600 sm:col-span-2">
              Descrição curta (opcional)
              <input
                value={f.descricao}
                onChange={(e) => setF({ ...f, descricao: e.target.value })}
                placeholder="Rodízio de carnes com buffet de saladas, a 5 minutos da Ponte."
                className={`mt-1 block w-full ${campo}`}
              />
            </label>

            <div className="sm:col-span-2">
              <label className="block text-sm text-slate-600">Foto</label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void enviarFoto(file);
                  }}
                  className="text-sm"
                />
                {enviando && <span className="text-xs text-slate-400">enviando…</span>}
              </div>
              {f.foto_url && (
                <div className="mt-2 aspect-[16/10] w-full max-w-xs overflow-hidden rounded-xl border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.foto_url} alt="" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={f.destaque}
                onChange={(e) => setF({ ...f, destaque: e.target.checked })}
              />
              Destaque no topo da lista
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />
              No ar
            </label>
          </div>

          <div className="mt-4">
            <CamposDeVenda
              dados={venda}
              onChange={setVenda}
              stores={stores}
              precos={precos}
              servico={f.destaque ? "restaurante_destaque" : "restaurante"}
              titulo="Quem paga por esta listagem"
            />
          </div>

          {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          <button
            onClick={salvar}
            disabled={salvando}
            className="mt-3 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            {salvando ? "Salvando…" : f.id ? "Salvar alterações" : "Cadastrar restaurante"}
          </button>
        </div>
      )}

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="procurar por nome, cidade ou cliente…"
          className={`w-full pl-9 ${campo}`}
        />
        {filtro && (
          <button
            onClick={() => setFiltro("")}
            aria-label="limpar"
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {visiveis.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            {restaurantes.length === 0
              ? "Nenhum restaurante cadastrado ainda."
              : "Nenhum restaurante com esse filtro."}
          </li>
        )}
        {visiveis.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
          >
            <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-slate-100">
              {r.foto_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.foto_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-slate-800">
                {r.destaque === 1 && <Star className="h-3.5 w-3.5 text-amber-500" />}
                <span className="truncate">{r.nome}</span>
              </p>
              <p className="text-xs text-slate-400">
                {tipos.find((x) => x.id === r.tipo)?.rotulo ?? r.tipo} · {r.cidade}
                {r.store_name ? ` · ${r.store_name}` : ""}
                {r.is_paid === 1 ? " · pago" : ""}
                {r.active === 0 ? " · fora do ar" : ""}
                {r.ends_at ? ` · até ${dia(r.ends_at)}` : ""}
              </p>
              {r.is_paid === 1 &&
                (r.pedido_numero ? (
                  <p className="text-[11px] text-brand-green-dark">
                    ✓ na conta · pedido {r.pedido_numero}
                  </p>
                ) : (
                  <p className="text-[11px] font-medium text-amber-700">⚠ ainda não está na conta</p>
                ))}
            </div>
            <button
              onClick={() => editar(r)}
              className="text-xs font-medium text-brand-green-dark hover:underline"
            >
              Editar
            </button>
            <button
              onClick={() => apagar(r.id)}
              aria-label="apagar"
              className="text-slate-300 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
