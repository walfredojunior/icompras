"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { DollarSign, Check } from "lucide-react";

// A LISTA DE PREÇOS DA DIVULGAÇÃO (21/08/2026).
//
// ⚠ POR QUE EXISTE. Ele pediu: "queria poder fazer uma lista de preço e na hora
// de definir o preço da divulgação ter uma lista ali". Antes o valor era
// digitado à mão em cada venda — a mesma categoria saía por preços diferentes
// conforme o dia, e não havia resposta rápida para "quanto custa o banner de
// perfume?".
//
// 💡 TUDO EM DÓLAR: ele confirmou que cobra em dólar, e o catálogo já é USD.
//
// ⚠ MUDAR UM PREÇO AQUI NÃO MEXE NO PASSADO. `pedido_item.valor` guarda uma
// cópia do valor no momento da venda — de propósito. Se o item apontasse para
// esta tabela, um reajuste reescreveria contas antigas.

interface Linha {
  id: number;
  servico: string;
  slot: string | null;
  faixa: string | null;
  descricao: string;
  valor_mensal: number;
  valor_trimestral: number | null;
  valor_semestral: number | null;
  ativo: number;
}

const ROTULO_SERVICO: Record<string, string> = {
  banner_categoria: "Banner de categoria",
  banner_home: "Banner na página inicial",
  destaque: "Destaque de produto",
  outro: "Outro serviço",
};

const ROTULO_SLOT: Record<string, string> = {
  topo: "topo",
  meio: "meio",
  fim: "fim",
};

const ROTULO_FAIXA: Record<string, string> = {
  grande: "grande",
  media: "média",
  pequena: "pequena",
};

const dol = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });

export function TabelaDePrecos({
  linhas,
  contagem,
}: {
  linhas: Linha[];
  /** Quantas categorias há em cada faixa — é o que explica o preço. */
  contagem: { grande: number; media: number; pequena: number };
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState<number | null>(null);
  const [edicao, setEdicao] = useState<Record<number, { m: string; t: string; s: string }>>({});
  const [err, setErr] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<number | null>(null);

  function valorEditado(l: Linha) {
    return (
      edicao[l.id] ?? {
        m: String(l.valor_mensal),
        t: l.valor_trimestral != null ? String(l.valor_trimestral) : "",
        s: l.valor_semestral != null ? String(l.valor_semestral) : "",
      }
    );
  }

  async function salvar(l: Linha) {
    const v = valorEditado(l);
    setSalvando(l.id);
    setErr(null);
    const res = await fetch("/api/admin/precos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: l.id,
        valor_mensal: Number(v.m || 0),
        valor_trimestral: v.t === "" ? null : Number(v.t),
        valor_semestral: v.s === "" ? null : Number(v.s),
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSalvando(null);
    if (!res.ok) {
      setErr(j.error ?? "Não deu certo.");
      return;
    }
    setSalvo(l.id);
    setTimeout(() => setSalvo(null), 2000);
    router.refresh();
  }

  const campo = "w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm";

  return (
    <div>
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="mb-1 font-semibold text-slate-800">Como as faixas funcionam</p>
        <p>
          O preço de um banner de categoria depende do <strong>tamanho da categoria</strong> — perfume
          tem dezenas de milhares de produtos, abajur tem algumas dezenas. O sistema descobre a faixa
          sozinho pelo número de produtos:
        </p>
        <ul className="mt-2 space-y-0.5 text-xs">
          <li>
            <strong>grande</strong> — 3.000 produtos ou mais · {contagem.grande} categorias
          </li>
          <li>
            <strong>média</strong> — de 500 a 2.999 · {contagem.media} categorias
          </li>
          <li>
            <strong>pequena</strong> — menos de 500 · {contagem.pequena} categorias
          </li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Mudar um preço aqui <strong>não altera</strong> pedidos já lançados: cada venda guarda o
          valor cobrado na época.
        </p>
      </div>

      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2">Serviço</th>
              <th className="pb-2">Espaço</th>
              <th className="pb-2">Faixa</th>
              <th className="pb-2">Mês</th>
              <th className="pb-2">Trimestre</th>
              <th className="pb-2">Semestre</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => {
              const v = valorEditado(l);
              const trocou =
                v.m !== String(l.valor_mensal) ||
                v.t !== (l.valor_trimestral != null ? String(l.valor_trimestral) : "") ||
                v.s !== (l.valor_semestral != null ? String(l.valor_semestral) : "");
              return (
                <tr key={l.id}>
                  <td className="py-2 text-slate-700">{ROTULO_SERVICO[l.servico] ?? l.servico}</td>
                  <td className="py-2 text-slate-500">{l.slot ? ROTULO_SLOT[l.slot] : "—"}</td>
                  <td className="py-2 text-slate-500">{l.faixa ? ROTULO_FAIXA[l.faixa] : "—"}</td>
                  {(["m", "t", "s"] as const).map((k) => (
                    <td key={k} className="py-2 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        value={v[k]}
                        onChange={(e) =>
                          setEdicao({ ...edicao, [l.id]: { ...v, [k]: e.target.value } })
                        }
                        placeholder={k === "m" ? "" : "opcional"}
                        className={campo}
                      />
                    </td>
                  ))}
                  <td className="py-2">
                    {salvo === l.id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-brand-green">
                        <Check className="h-3.5 w-3.5" /> salvo
                      </span>
                    ) : (
                      <button
                        onClick={() => salvar(l)}
                        disabled={salvando === l.id || !trocou}
                        className="rounded-lg bg-brand-navy px-3 py-1 text-xs font-medium text-white disabled:opacity-30"
                      >
                        salvar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        <DollarSign className="h-3.5 w-3.5" />
        Todos os valores em dólar. Deixe trimestre e semestre em branco para vender só por mês.
      </p>
    </div>
  );
}
