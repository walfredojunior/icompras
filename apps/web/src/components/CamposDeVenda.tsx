"use client";

import { useEffect } from "react";
import { DollarSign } from "lucide-react";
import { hoje, fimDoPeriodo } from "@/lib/datas";

// OS CAMPOS DE VENDA — loja, período e valor — de qualquer espaço monetizado.
//
// ⚠ POR QUE UM COMPONENTE SÓ (22/08/2026). Ele pediu para monetizar também os
// Destaques e os Blocos de destaque, "mesma coisa" dos banners: escolher o
// cliente, pôr o preço, entrar na conta a receber e ter vencimento.
//
// Repetir esse formulário em três telas era garantir que na primeira mudança
// (um campo novo, uma regra de preço) duas delas ficassem para trás. Aqui é um
// bloco só, e cada tela diz apenas QUAL serviço está vendendo.
//
// 💡 O VENCIMENTO É O QUE MAIS FALTAVA nesses dois: destaque e bloco não tinham
// data nenhuma. Uma vez ligados, ficavam no ar até alguém lembrar de desligar —
// e ninguém lembra. Vendido por um mês, entregue para sempre.

export interface LinhaDePrecoLite {
  id: number;
  servico: string;
  slot: string | null;
  faixa: string | null;
  valor_mensal: number;
  valor_trimestral: number | null;
  valor_semestral: number | null;
  ativo: number;
}

export interface DadosDaVenda {
  store_id: string;
  is_paid: boolean;
  valor: string;
  duracao: string;
  starts_at: string;
  ends_at: string;
}

export const VENDA_VAZIA: DadosDaVenda = {
  store_id: "",
  is_paid: false,
  valor: "",
  duracao: "mensal",
  starts_at: "",
  ends_at: "",
};

/** O preço de tabela de um serviço sem faixa (destaque, bloco, "Onde comer"). */
export function precoDoServico(
  precos: LinhaDePrecoLite[],
  servico: string,
  duracao: string,
): number | null {
  const linha = precos.find((p) => p.servico === servico && p.ativo);
  if (!linha) return null;
  if (duracao === "trimestral" && linha.valor_trimestral != null) return linha.valor_trimestral;
  if (duracao === "semestral" && linha.valor_semestral != null) return linha.valor_semestral;
  if (duracao === "avulso") return null;
  return linha.valor_mensal;
}

const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function CamposDeVenda({
  dados,
  onChange,
  stores,
  precos,
  servico,
  titulo,
}: {
  dados: DadosDaVenda;
  onChange: (d: DadosDaVenda) => void;
  stores: Array<{ id: number; name: string; ehCliente?: boolean }>;
  precos: LinhaDePrecoLite[];
  /** Qual linha da tabela de preços usar: "destaque", "bloco"… */
  servico: string;
  titulo: string;
}) {
  const sugerido = precoDoServico(precos, servico, dados.duracao);
  const loja = stores.find((s) => String(s.id) === dados.store_id);

  // ⚠ A data de hoje entra depois da montagem, no navegador: o servidor está em
  // UTC e ele no Paraguai (-3) — calcular durante a montagem daria dias
  // diferentes depois das 21h. Ver lib/datas.ts.
  useEffect(() => {
    if (!dados.starts_at) onChange({ ...dados, starts_at: hoje() });
    // Só na primeira montagem: depois disso, quem manda na data é ele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <DollarSign className="h-3.5 w-3.5" /> {titulo}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          Cliente (opcional)
          <select
            value={dados.store_id}
            onChange={(e) => onChange({ ...dados, store_id: e.target.value })}
            className={`mt-1 block w-full ${campo}`}
          >
            <option value="">— nenhum, é do próprio site —</option>
            {/* ⚠ Clientes primeiro, leads depois — mesma separação da tela de
                banners. São poucos clientes entre muitas lojas do coletor. */}
            {stores.some((s) => s.ehCliente) && (
              <optgroup label="Clientes">
                {stores
                  .filter((s) => s.ehCliente)
                  .map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            )}
            {stores.some((s) => !s.ehCliente) && (
              <optgroup label="Lojas do catálogo (ainda não são clientes)">
                {stores
                  .filter((s) => !s.ehCliente)
                  .map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </label>

        <label className="flex items-end gap-2 pb-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={dados.is_paid}
            onChange={(e) => {
              const pago = e.target.checked;
              // Já traz o preço de tabela ao marcar: é o número que ele vai
              // falar para o cliente, e poupa um clique.
              onChange({
                ...dados,
                is_paid: pago,
                valor:
                  pago && !dados.valor
                    ? String(precoDoServico(precos, servico, dados.duracao) ?? "")
                    : dados.valor,
              });
            }}
          />
          É publicidade paga
        </label>

        {/* ⚠ O PERÍODO VALE MESMO SEM COBRANÇA: dá para pôr um destaque só até o
            fim da promoção, sem vender para ninguém. Por isso fica fora do
            bloco de cobrança. */}
        <label className="text-xs text-slate-600">
          Começa em (opcional)
          <input
            type="date"
            value={dados.starts_at}
            onChange={(e) =>
              onChange({
                ...dados,
                starts_at: e.target.value,
                ends_at: fimDoPeriodo(e.target.value, dados.duracao) || dados.ends_at,
              })
            }
            className={`mt-1 block w-full ${campo}`}
          />
        </label>
        <label className="text-xs text-slate-600">
          Termina em (opcional)
          <input
            type="date"
            value={dados.ends_at}
            onChange={(e) => onChange({ ...dados, ends_at: e.target.value })}
            className={`mt-1 block w-full ${campo}`}
          />
        </label>
      </div>

      {/* ⚠ SEM CLIENTE NÃO HÁ ONDE COBRAR — e sem este aviso ele marcava "é
          publicidade paga", não via campo de preço nenhum e concluía que a tela
          não tinha onde digitar o valor. Foi exatamente o que aconteceu em
          22/08/2026. */}
      {dados.is_paid && !dados.store_id && (
        <p className="mt-2 text-xs text-amber-700">
          Escolha o cliente acima para poder lançar o valor na conta dele.
        </p>
      )}

      {dados.is_paid && dados.store_id && (
        <div className="mt-3 rounded-lg border border-brand-green bg-brand-green-light p-2.5">
          <p className="mb-2 text-xs font-semibold text-brand-green-dark">
            Entra na conta de {loja?.name}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-600">
              Por quanto tempo
              <select
                value={dados.duracao}
                onChange={(e) => {
                  const d = e.target.value;
                  // 💡 O TÉRMINO SE CALCULA SOZINHO pela duração — mais útil que
                  // preencher com "hoje", que criaria um anúncio vencendo no
                  // mesmo dia. Continua editável.
                  const inicio = dados.starts_at || hoje();
                  onChange({
                    ...dados,
                    duracao: d,
                    starts_at: inicio,
                    ends_at: fimDoPeriodo(inicio, d) || dados.ends_at,
                    valor: String(precoDoServico(precos, servico, d) ?? ""),
                  });
                }}
                className={`mt-1 block ${campo}`}
              >
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="avulso">Avulso (valor livre)</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Valor a cobrar (US$)
              <input
                type="number"
                step="0.01"
                value={dados.valor}
                onChange={(e) => onChange({ ...dados, valor: e.target.value })}
                placeholder="0,00"
                className={`mt-1 block w-32 ${campo}`}
              />
            </label>
            {sugerido != null && (
              <button
                type="button"
                onClick={() => onChange({ ...dados, valor: String(sugerido) })}
                className="mb-1 text-xs font-medium text-brand-navy hover:underline"
              >
                usar tabela (US$ {sugerido})
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {Number(dados.valor) > 0
              ? "Ao salvar, este valor entra na conta do cliente automaticamente."
              : "Sem valor, entra sem cobrança — dá para lançar depois."}
          </p>
        </div>
      )}
    </div>
  );
}
