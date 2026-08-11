"use client";

import { useState } from "react";
import { ExternalLink, Save, Check, AlertTriangle } from "lucide-react";
import type { IaVista } from "@/lib/iaConfig";

// Tela de configuração dos serviços de IA (Admin › IA).
//
// Pedido dele em 11/08/2026: "no admin vai ter que ter um setting das IA, e aí
// ficar as configurações e keys de cada IA". Desenho copiado do KaruGO-Chef.
//
// Três coisas guiaram o layout:
//  • **O teto vem antes da chave.** A conta é dele; o número que impede um
//    domingo caro importa mais que o modelo escolhido.
//  • **O gasto do mês fica visível ao lado do teto**, senão o teto é um número
//    abstrato que ninguém acompanha.
//  • **Os links de saldo e de chave ficam na própria seção.** A pergunta "onde
//    eu vejo isso mesmo?" aparece no dia em que algo parou — o pior dia para
//    procurar.

const ONDE: Record<string, { nome: string; saldo: string; chaves: string; nota?: string }> = {
  deepseek: {
    nome: "DeepSeek",
    saldo: "https://platform.deepseek.com/usage",
    chaves: "https://platform.deepseek.com/api_keys",
    nota: "Pré-pago. Saldo zerado = a API passa a recusar.",
  },
  fal: {
    nome: "fal.ai (FLUX)",
    saldo: "https://fal.ai/dashboard/usage-billing/credits",
    chaves: "https://fal.ai/dashboard/keys",
    nota: "Pré-pago: saldo zerado bloqueia a conta.",
  },
  openai: {
    nome: "OpenAI (GPT Image)",
    saldo: "https://platform.openai.com/settings/organization/billing/overview",
    chaves: "https://platform.openai.com/api-keys",
    nota: "Exige faturamento ativo na organização.",
  },
  google: {
    nome: "Google",
    saldo: "https://console.cloud.google.com/billing",
    chaves: "https://aistudio.google.com/api-keys",
    nota: "Geração de imagem não tem camada gratuita.",
  },
};

const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

function Links({ p }: { p: string }) {
  const o = ONDE[p];
  if (!o) return null;
  return (
    <div className="mt-2 text-xs text-slate-500">
      {o.nota && <p className="mb-1">{o.nota}</p>}
      <a href={o.saldo} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex items-center gap-1 text-brand-navy hover:underline">
        <ExternalLink className="h-3 w-3" /> ver saldo
      </a>
      <a href={o.chaves} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-navy hover:underline">
        <ExternalLink className="h-3 w-3" /> gerar chave
      </a>
    </div>
  );
}

/** Barra de consumo: o teto só serve se der para ver o quanto já foi. */
function Consumo({ usado, limite, falhas, unidade }: { usado: number; limite: number; falhas: number; unidade: string }) {
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  const apertado = pct >= 80;
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className={apertado ? "font-semibold text-amber-700" : "text-slate-500"}>
          {usado.toLocaleString("pt-BR")} de {limite.toLocaleString("pt-BR")} {unidade}
        </span>
        {falhas > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            {falhas} falha(s)
          </span>
        )}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${apertado ? "bg-amber-500" : "bg-brand-green"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Chave({
  rotulo,
  atual,
  valor,
  onChange,
}: {
  rotulo: string;
  atual: string | null;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm text-slate-600">
      {rotulo}
      <input
        type="password"
        autoComplete="new-password"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={atual ? `guardada (${atual}) — preencha só para trocar` : "não cadastrada"}
        className={`mt-1 block w-full ${campo}`}
      />
      {/* Campo em branco não apaga: a tela nunca recebe o valor atual, então
          "vazio" quer dizer "não mexi nisso". Para apagar, a palavra APAGAR. */}
      <span className="mt-1 block text-[11px] text-slate-400">
        Deixe em branco para manter. Escreva <code>APAGAR</code> para remover.
      </span>
    </label>
  );
}

export function IaSettings({ inicial }: { inicial: IaVista }) {
  const [c, setC] = useState(inicial);
  const [chaves, setChaves] = useState({ texto_key: "", img_key_fal: "", img_key_openai: "", img_key_google: "", busca_key: "" });
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const corpo = {
      texto_ativo: c.texto.ativo,
      texto_provider: c.texto.provider,
      texto_model: c.texto.model,
      texto_limite_mes: c.texto.limiteMes,
      img_ativo: c.imagem.ativo,
      img_provider: c.imagem.provider,
      img_model: c.imagem.model,
      img_limite_mes: c.imagem.limiteMes,
      busca_ativo: c.busca.ativo,
      busca_provider: c.busca.provider,
      busca_cx: c.busca.cx ?? "",
      busca_limite_dia: c.busca.limiteDia,
      ...chaves,
    };
    const r = await fetch("/api/admin/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return setErro(j.error ?? "não consegui salvar");
    setC(j.config);
    setChaves({ texto_key: "", img_key_fal: "", img_key_openai: "", img_key_google: "", busca_key: "" });
    setPronto(true);
    setTimeout(() => setPronto(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* TEXTO */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">Descrições de produto</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Gera a descrição a partir do nome e da ficha do produto. A loja revisa antes de publicar.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input type="checkbox" checked={c.texto.ativo} onChange={(e) => setC({ ...c, texto: { ...c.texto, ativo: e.target.checked } })} />
            ligado
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-600">
            Modelo
            <input value={c.texto.model} onChange={(e) => setC({ ...c, texto: { ...c.texto, model: e.target.value } })} className={`mt-1 block w-full ${campo}`} />
          </label>
          <label className="text-sm text-slate-600">
            Teto por mês (chamadas)
            <input type="number" min={0} value={c.texto.limiteMes} onChange={(e) => setC({ ...c, texto: { ...c.texto, limiteMes: Number(e.target.value) } })} className={`mt-1 block w-full ${campo}`} />
          </label>
          <div className="sm:col-span-1">
            <Chave rotulo="Chave" atual={c.texto.chave} valor={chaves.texto_key} onChange={(v) => setChaves({ ...chaves, texto_key: v })} />
          </div>
        </div>
        <Consumo usado={c.texto.usoMes} limite={c.texto.limiteMes} falhas={c.texto.falhasMes} unidade="no mês" />
        <Links p={c.texto.provider} />
      </section>

      {/* IMAGEM GERADA */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">Fotos geradas por IA</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Último recurso, quando não houver foto real. A imagem é <strong>inventada</strong> — aparece
              marcada como ilustração para não passar por foto do produto.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input type="checkbox" checked={c.imagem.ativo} onChange={(e) => setC({ ...c, imagem: { ...c.imagem, ativo: e.target.checked } })} />
            ligado
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-600">
            Provedor
            <select value={c.imagem.provider} onChange={(e) => setC({ ...c, imagem: { ...c.imagem, provider: e.target.value } })} className={`mt-1 block w-full ${campo}`}>
              <option value="fal">fal.ai (FLUX)</option>
              <option value="openai">OpenAI (GPT Image)</option>
              <option value="google">Google (Nano Banana)</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Modelo
            <input value={c.imagem.model} onChange={(e) => setC({ ...c, imagem: { ...c.imagem, model: e.target.value } })} className={`mt-1 block w-full ${campo}`} />
          </label>
          <label className="text-sm text-slate-600">
            Teto por mês (imagens)
            <input type="number" min={0} value={c.imagem.limiteMes} onChange={(e) => setC({ ...c, imagem: { ...c.imagem, limiteMes: Number(e.target.value) } })} className={`mt-1 block w-full ${campo}`} />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Chave rotulo="Chave fal.ai" atual={c.imagem.chaves.fal} valor={chaves.img_key_fal} onChange={(v) => setChaves({ ...chaves, img_key_fal: v })} />
          <Chave rotulo="Chave OpenAI" atual={c.imagem.chaves.openai} valor={chaves.img_key_openai} onChange={(v) => setChaves({ ...chaves, img_key_openai: v })} />
          <Chave rotulo="Chave Google" atual={c.imagem.chaves.google} valor={chaves.img_key_google} onChange={(v) => setChaves({ ...chaves, img_key_google: v })} />
        </div>
        <Consumo usado={c.imagem.usoMes} limite={c.imagem.limiteMes} falhas={c.imagem.falhasMes} unidade="no mês" />
        <Links p={c.imagem.provider} />
      </section>

      {/* BUSCA DE FOTO REAL */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-900">Busca de foto real na web</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Procura a foto verdadeira do produto. Vem antes da IA: foto real vale mais que foto bonita.
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input type="checkbox" checked={c.busca.ativo} onChange={(e) => setC({ ...c, busca: { ...c.busca, ativo: e.target.checked } })} />
            ligado
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-600">
            Mecanismo (cx)
            <input value={c.busca.cx ?? ""} onChange={(e) => setC({ ...c, busca: { ...c.busca, cx: e.target.value } })} className={`mt-1 block w-full ${campo}`} />
          </label>
          <label className="text-sm text-slate-600">
            Cota por dia
            <input type="number" min={0} value={c.busca.limiteDia} onChange={(e) => setC({ ...c, busca: { ...c.busca, limiteDia: Number(e.target.value) } })} className={`mt-1 block w-full ${campo}`} />
          </label>
          <Chave rotulo="Chave" atual={c.busca.chave} valor={chaves.busca_key} onChange={(v) => setChaves({ ...chaves, busca_key: v })} />
        </div>
        <Consumo usado={c.busca.usoHoje} limite={c.busca.limiteDia} falhas={c.busca.falhasHoje} unidade="hoje" />
        <Links p={c.busca.provider} />
      </section>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-green px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {pronto && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="h-4 w-4" /> salvo
          </span>
        )}
      </div>

      <p className="text-xs leading-relaxed text-slate-400">
        As chaves ficam cifradas no banco e nunca chegam a esta tela — você vê só os quatro últimos
        caracteres, para confirmar qual está lá. Os tetos param o serviço quando atingidos, em vez de
        continuar gastando: a conta é sua.
      </p>
    </div>
  );
}
