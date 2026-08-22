"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Plus, Trash2, Receipt } from "lucide-react";
import { hoje, FORMAS_DE_PAGAMENTO } from "@/lib/datas";

// A CONTA DO CLIENTE — o que ele comprou, o que pagou, o que deve.
//
// ⚠ POR QUE EXISTE (21/08/2026). Ele quer vender espaço de banner por categoria
// e "outros serviços", e lançar na conta do cliente o valor que cobrou ou vai
// cobrar. Antes só existia assinatura de plano: uma loja, um plano, um valor.
//
// 💡 NÃO cobra nada automaticamente. Registra o que foi combinado e o que ele
// recebeu, do jeito que já cobra hoje — com 1 assinatura ativa e nenhum
// pagamento no sistema, montar gateway agora seria resolver um problema que
// ainda não existe.

interface Item {
  id: number;
  tipo: string;
  descricao: string;
  category_slug: string | null;
  inicio: string | null;
  fim: string | null;
  valor: number;
  banner_estado?: "no_ar" | "fora_do_ar" | "apagado" | null;
}
interface Pagamento {
  id: number;
  valor: number;
  pago_em: string;
  forma: string | null;
}
interface Pedido {
  id: number;
  numero: string;
  status: string;
  emitido_em: string | null;
  observacao: string | null;
  itens: Item[];
  pagamentos?: Pagamento[];
  total: number;
  pago: number;
  aberto: number;
}

const TIPOS: Array<{ id: string; rotulo: string }> = [
  { id: "banner_categoria", rotulo: "Banner de categoria" },
  { id: "banner_home", rotulo: "Banner na home" },
  { id: "destaque", rotulo: "Destaque" },
  { id: "plano", rotulo: "Mensalidade do plano" },
  { id: "outro", rotulo: "Outro serviço" },
];

// ⚠ DÓLAR. Esta tela nasceu em reais e ficou para trás quando ele confirmou
// que cobra em dólar (21/08/2026) — o banco e a tabela de preços foram
// trocados, esta linha não. Achado em 22/08 ao rever a conta.
const dinheiro = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "USD" });

const dia = (s: string | null) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");

/** "efetivo" vira "Efetivo (dinheiro)". Formas antigas, escritas à mão, passam como estão. */
const rotuloForma = (f: string) => FORMAS_DE_PAGAMENTO.find((x) => x.id === f)?.rotulo ?? f;

export function ContaDoCliente({
  storeId,
  pedidos,
  categorias,
}: {
  storeId: number;
  pedidos: Pedido[];
  categorias: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [abrindoItem, setAbrindoItem] = useState<number | null>(null);
  const [abrindoPag, setAbrindoPag] = useState<number | null>(null);

  const ITEM_VAZIO = {
    tipo: "banner_categoria",
    descricao: "",
    category_slug: "",
    inicio: "",
    fim: "",
    valor: "",
  };
  const [item, setItem] = useState(ITEM_VAZIO);
  const [pag, setPag] = useState({ valor: "", pago_em: "", forma: "efetivo" });

  // ⚠ A DATA DE HOJE É PREENCHIDA AQUI, e não no valor inicial do estado.
  //
  // O servidor roda em UTC e ele está no Paraguai (-3). Como esta tela também é
  // montada no servidor na primeira carga, calcular "hoje" ali faria o servidor
  // escrever um dia e o navegador outro — depois das 21h, datas diferentes na
  // mesma tela. Dentro do `useEffect` só roda no navegador, no fuso dele.
  useEffect(() => {
    const d = hoje();
    setPag((p) => (p.pago_em ? p : { ...p, pago_em: d }));
    setItem((i) => (i.inicio ? i : { ...i, inicio: d }));
  }, []);

  async function chamar(corpo: Record<string, unknown>) {
    setSalvando(true);
    setErr(null);
    const res = await fetch("/api/admin/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const j = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErr(j.error ?? "Não deu certo.");
      return false;
    }
    router.refresh();
    return true;
  }

  const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

  // Tudo o que este cliente deve, somando os pedidos que não foram cancelados.
  const devendo = pedidos.reduce((s, p) => s + (p.status === "cancelado" ? 0 : p.aberto), 0);

  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Receipt className="h-4 w-4 text-slate-400" />
          Conta do cliente
        </h2>
        <div className="flex items-center gap-3">
          {devendo > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
              em aberto: {dinheiro(devendo)}
            </span>
          )}
          <button
            onClick={() => chamar({ acao: "criar", store_id: storeId })}
            disabled={salvando}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
          >
            + Novo pedido
          </button>
        </div>
      </div>

      {err && <p className="mb-3 text-sm text-red-600">{err}</p>}

      {pedidos.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhum pedido ainda. Crie um para lançar banners e serviços vendidos a este cliente.
        </p>
      )}

      <div className="space-y-4">
        {pedidos.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <div>
                <span className="text-sm font-semibold text-slate-800">Pedido {p.numero}</span>
                <span className="ml-2 text-xs text-slate-400">{dia(p.emitido_em)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">total {dinheiro(p.total)}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">pago {dinheiro(p.pago)}</span>
                {p.aberto > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                    falta {dinheiro(p.aberto)}
                  </span>
                ) : (
                  <span className="rounded-full bg-brand-green-light px-2 py-0.5 font-semibold text-brand-green-dark">
                    quitado
                  </span>
                )}
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {p.itens.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-slate-700">{i.descricao}</p>
                    <p className="text-[11px] text-slate-400">
                      {TIPOS.find((t) => t.id === i.tipo)?.rotulo ?? i.tipo}
                      {i.category_slug && ` · ${i.category_slug}`}
                      {(i.inicio || i.fim) && ` · ${dia(i.inicio)} a ${dia(i.fim)}`}
                    </p>
                    {/* O estado do banner que este item pagou — ele reparou que
                        faltava. Cobrado com o banner fora do ar é cliente
                        pagando por nada. */}
                    {i.banner_estado && (
                      <p className="mt-0.5 text-[11px]">
                        {i.banner_estado === "no_ar" && (
                          <span className="text-brand-green-dark">● banner no ar</span>
                        )}
                        {i.banner_estado === "fora_do_ar" && (
                          <span className="text-amber-700">● banner fora do ar</span>
                        )}
                        {i.banner_estado === "apagado" && (
                          <span className="text-slate-400">● banner apagado</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">{dinheiro(Number(i.valor))}</span>
                    <button
                      onClick={() => chamar({ acao: "apagar_item", item_id: i.id })}
                      disabled={salvando}
                      aria-label="apagar item"
                      className="text-slate-300 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
              {p.itens.length === 0 && <li className="px-4 py-2 text-xs text-slate-400">Sem itens ainda.</li>}
            </ul>

            {/* OS RECEBIMENTOS. A forma de pagamento era gravada e nunca
                aparecia — ele registrava "recebi por transferência" e não tinha
                onde conferir depois. */}
            {p.pagamentos && p.pagamentos.length > 0 && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50">
                {p.pagamentos.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-1.5 text-xs">
                    <span className="text-slate-500">
                      recebido em {dia(g.pago_em)}
                      {g.forma && ` · ${rotuloForma(g.forma)}`}
                    </span>
                    <span className="font-medium text-brand-green-dark">+{dinheiro(Number(g.valor))}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-2">
              <button
                onClick={() => {
                  setAbrindoItem(abrindoItem === p.id ? null : p.id);
                  setAbrindoPag(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-400"
              >
                <Plus className="h-3 w-3" /> item
              </button>
              <button
                onClick={() => {
                  const abrindo = abrindoPag !== p.id;
                  setAbrindoPag(abrindo ? p.id : null);
                  setAbrindoItem(null);
                  // 💡 Já vem com o que falta: o caso normal é receber a conta
                  // inteira, e digitar de novo um número que o sistema conhece
                  // é onde nasce o erro de digitação.
                  if (abrindo) setPag((x) => ({ ...x, valor: p.aberto > 0 ? String(p.aberto) : "" }));
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-slate-400"
              >
                <Plus className="h-3 w-3" /> pagamento
              </button>
            </div>

            {abrindoItem === p.id && (
              <div className="grid gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:grid-cols-2">
                <select
                  value={item.tipo}
                  onChange={(e) => setItem({ ...item, tipo: e.target.value })}
                  className={campo}
                >
                  {TIPOS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
                <input
                  value={item.descricao}
                  onChange={(e) => setItem({ ...item, descricao: e.target.value })}
                  placeholder="Descrição (ex.: Banner de perfume, setembro)"
                  className={campo}
                />
                {item.tipo === "banner_categoria" && (
                  <select
                    value={item.category_slug}
                    onChange={(e) => setItem({ ...item, category_slug: e.target.value })}
                    className={campo}
                  >
                    <option value="">— categoria —</option>
                    {categorias.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="number"
                  step="0.01"
                  value={item.valor}
                  onChange={(e) => setItem({ ...item, valor: e.target.value })}
                  placeholder="Valor (US$)"
                  className={campo}
                />
                <label className="text-xs text-slate-500">
                  Começa
                  <input
                    type="date"
                    value={item.inicio}
                    onChange={(e) => setItem({ ...item, inicio: e.target.value })}
                    className={`mt-1 block w-full ${campo}`}
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Termina
                  <input
                    type="date"
                    value={item.fim}
                    onChange={(e) => setItem({ ...item, fim: e.target.value })}
                    className={`mt-1 block w-full ${campo}`}
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    onClick={async () => {
                      const ok = await chamar({
                        acao: "item",
                        pedido_id: p.id,
                        ...item,
                        valor: Number(item.valor || 0),
                      });
                      if (ok) {
                        setItem(ITEM_VAZIO);
                        setAbrindoItem(null);
                      }
                    }}
                    disabled={salvando}
                    className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    Lançar item
                  </button>
                </div>
              </div>
            )}

            {abrindoPag === p.id && (
              <div className="grid gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:grid-cols-3">
                {/* ⚠ O TETO É O QUE ESTÁ EM ABERTO (pedido dele em 22/08/2026).
                    `max` impede subir com a setinha, mas não impede digitar —
                    por isso o aviso abaixo e a recusa no servidor. */}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={p.aberto}
                  value={pag.valor}
                  onChange={(e) => setPag({ ...pag, valor: e.target.value })}
                  placeholder={`Valor recebido (máx. ${dinheiro(p.aberto)})`}
                  className={`${campo} ${Number(pag.valor) > p.aberto ? "border-red-400" : ""}`}
                />
                <input
                  type="date"
                  value={pag.pago_em}
                  onChange={(e) => setPag({ ...pag, pago_em: e.target.value })}
                  className={campo}
                />
                <select
                  value={pag.forma}
                  onChange={(e) => setPag({ ...pag, forma: e.target.value })}
                  className={campo}
                >
                  {FORMAS_DE_PAGAMENTO.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.rotulo}
                    </option>
                  ))}
                </select>
                <div className="sm:col-span-3">
                  {Number(pag.valor) > p.aberto && (
                    <p className="mb-2 text-xs font-medium text-red-600">
                      Este pedido tem {dinheiro(p.aberto)} em aberto. Para receber mais, lance antes
                      o serviço extra como item.
                    </p>
                  )}
                  <button
                    onClick={async () => {
                      const ok = await chamar({ acao: "pagamento", pedido_id: p.id, ...pag });
                      if (ok) {
                        setPag({ valor: "", pago_em: hoje(), forma: "efetivo" });
                        setAbrindoPag(null);
                      }
                    }}
                    disabled={salvando || !pag.valor || Number(pag.valor) > p.aberto || Number(pag.valor) <= 0}
                    className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                  >
                    Registrar pagamento
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
