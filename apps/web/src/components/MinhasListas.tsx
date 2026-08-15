"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Minus, Plus, Trash2, Share2, Loader2 } from "lucide-react";
import {
  lerListas, criarLista, apagarLista, renomearLista, mudarQuantidade, remover,
  guardarToken, EVENTO, type Lista,
} from "@/lib/listaLocal";

/** Cota da Receita Federal por pessoa, via terrestre. Ver o comentário do total. */
const COTA_USD = 500;

interface Preco {
  id: number; preco: number | null; lojas: number; slug: string; nome: string;
  imagem: string | null;
  /** Sem nenhuma oferta no ar. Ver o comentário grande em /api/listas/precos. */
  foraDoAr?: boolean;
  /** Por quanto era, quando ainda havia. Só para dar contexto — nunca soma. */
  ultimoPreco?: number | null;
}

export function MinhasListas({ textos }: { textos: Record<string, string> }) {
  const [listas, setListas] = useState<Lista[]>([]);
  const [precos, setPrecos] = useState<Map<number, Preco>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [compartilhando, setCompartilhando] = useState<string | null>(null);
  const [montado, setMontado] = useState(false);

  const buscarPrecos = useCallback(async (ls: Lista[]) => {
    const ids = [...new Set(ls.flatMap((l) => l.itens.map((i) => i.id)))];
    if (!ids.length) { setPrecos(new Map()); setCarregando(false); return; }
    try {
      const r = await fetch("/api/listas/precos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const d = await r.json();
      setPrecos(new Map((d.produtos ?? []).map((p: Preco) => [p.id, p])));
    } catch {
      // Sem rede: a lista continua na tela, só sem os preços. Melhor do que
      // sumir com tudo por causa de uma consulta que falhou.
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    setMontado(true);
    const carregar = () => {
      let ls = lerListas();
      // JÁ COMEÇA COM UMA LISTA PRONTA — pedido dele em 15/08/2026.
      //
      // 💡 Antes, quem chegava sem nada via "Você ainda não tem favoritos" e um
      // botão para criar. É um passo a mais antes de qualquer utilidade: a
      // pessoa precisa entender que existe o conceito de "lista", decidir criar
      // uma e dar nome, tudo antes de ver um produto sequer. Começando com
      // "Minha lista" pronta, ela só adiciona — e renomeia depois se quiser.
      //
      // Não custa nada: a lista vive no navegador dela, é uma linha guardada.
      if (!ls.length) {
        criarLista(textos.novaPadrao);
        ls = lerListas();
      }
      setListas(ls);
      buscarPrecos(ls);
    };
    carregar();
    window.addEventListener(EVENTO, carregar);
    return () => window.removeEventListener(EVENTO, carregar);
  }, [buscarPrecos, textos.novaPadrao]);

  // ⚠ Nada é desenhado antes de o navegador assumir: a lista só existe aqui,
  // e o servidor renderizaria uma tela vazia que "pularia" ao carregar.
  if (!montado) return null;

  async function compartilhar(l: Lista) {
    setCompartilhando(l.id);
    try {
      const r = await fetch("/api/listas/compartilhar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: l.nome,
          itens: l.itens.map((i) => ({ p: i.id, q: i.quantidade, o: i.observacao ?? "" })),
        }),
      });
      const d = await r.json();
      if (!d.token) throw new Error("sem token");
      guardarToken(l.id, d.token);
      const url = `${window.location.origin}/lista/${d.token}`;
      const msg = `${textos.zapPrefixo} "${l.nome}" — ${url}`;
      // Abre o WhatsApp com a mensagem pronta. `wa.me` funciona no aplicativo
      // do celular e no WhatsApp Web, sem precisar saber o número de ninguém.
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    } catch {
      alert(textos.erroCompartilhar);
    }
    setCompartilhando(null);
  }

  // ⚠ A tela de "nenhum favorito" quase não aparece mais: o carregamento acima
  // já cria "Minha lista" quando não há nenhuma. Fica como rede de segurança
  // para o caso de o navegador bloquear o armazenamento local (modo privado
  // em alguns aparelhos) — aí criar falha em silêncio e a tela não pode ficar
  // em branco.
  if (!listas.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Heart className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 font-medium text-slate-700">{textos.vazioTitulo}</p>
        <p className="mt-1 text-sm text-slate-500">{textos.vazioTexto}</p>
        <button
          onClick={() => { criarLista(textos.novaPadrao); }}
          className="mt-4 rounded-xl bg-brand-navy px-4 py-2 text-sm font-medium text-white"
        >
          {textos.criar}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {listas.map((l) => {
        const itens = l.itens.map((i) => ({ ...i, atual: precos.get(i.id) }));
        // Só soma o que TEM preço: item sem oferta no ar entraria como zero e
        // faria o total mentir para baixo, que é o pior jeito de errar aqui.
        const comPreco = itens.filter((i) => i.atual?.preco != null);
        const total = comPreco.reduce((s, i) => s + (i.atual!.preco ?? 0) * i.quantidade, 0);
        const semPreco = itens.length - comPreco.length;
        const pctCota = Math.min(999, Math.round((total / COTA_USD) * 100));
        const passou = total > COTA_USD;

        return (
          <section key={l.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <input
                defaultValue={l.nome}
                onBlur={(e) => renomearLista(l.id, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold text-slate-900 hover:border-slate-200 focus:border-brand-green focus:outline-none"
                aria-label={textos.nomeDaLista}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => compartilhar(l)}
                  disabled={!l.itens.length || compartilhando === l.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {compartilhando === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  {textos.compartilhar}
                </button>
                <button
                  onClick={() => { if (confirm(textos.confirmaApagar)) apagarLista(l.id); }}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:border-rose-300 hover:text-rose-500"
                  aria-label={textos.apagarLista}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </header>

            {!l.itens.length ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">{textos.listaVazia}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {/* ⚠ DUAS FILEIRAS NO CELULAR, uma no computador.
                    A primeira versão punha foto + nome + quantidade + preço +
                    lixeira tudo numa linha. No computador ficou bom; no celular
                    de 390px o nome foi espremido a ponto de virar "Câ D.." —
                    três câmeras diferentes na tela, todas com o mesmo rótulo
                    ilegível. Só apareceu na FOTO da tela.
                    Agora o nome tem a largura inteira e os controles descem
                    para uma segunda fileira, que é o padrão de carrinho em
                    celular. 95% das visitas são de telefone. */}
                {itens.map((i) => (
                  <li key={i.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <a href={`/produto/${i.slug}`} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white">
                        {i.imagem ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.imagem} alt="" className="max-h-14 object-contain" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src="/logo-icon.png" alt="" className="h-8 w-auto opacity-30" />
                        )}
                      </a>
                      <div className="min-w-0 flex-1">
                        <a href={`/produto/${i.slug}`} className="line-clamp-2 text-sm font-medium leading-snug text-slate-800 hover:text-brand-navy">
                          {i.nome}
                        </a>
                        {/* ⚠ PRODUTO FORA DO AR PRECISA GRITAR, não sussurrar.
                            Ele fica na lista de propósito (a pessoa escolheu, e
                            apagar sozinho seria pior), mas em âmbar e com o
                            aviso claro — e FORA da soma. Mostrar o último preço
                            conhecido ajuda a decidir se vale procurar parecido. */}
                        {carregando ? (
                          <p className="mt-1 text-xs text-slate-500">{textos.buscandoPreco}</p>
                        ) : i.atual?.preco != null ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {`US$ ${i.atual.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${i.atual.lojas ? ` · ${i.atual.lojas} ${textos.lojas}` : ""}`}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs font-medium text-amber-600">
                            {textos.foraDoAr}
                            {i.atual?.ultimoPreco
                              ? ` · ${textos.eraPor} US$ ${i.atual.ultimoPreco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                              : ""}
                          </p>
                        )}
                      </div>
                      <button onClick={() => remover(l.id, i.id)}
                        className="shrink-0 p-1 text-slate-300 hover:text-rose-500" aria-label={textos.remover}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between pl-[68px] sm:pl-0">
                      <div className="flex items-center gap-1">
                        <button onClick={() => mudarQuantidade(l.id, i.id, i.quantidade - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-400"
                          aria-label={textos.menos}><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-8 text-center text-sm font-medium">{i.quantidade}</span>
                        <button onClick={() => mudarQuantidade(l.id, i.id, i.quantidade + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-slate-400"
                          aria-label={textos.mais}><Plus className="h-3.5 w-3.5" /></button>
                      </div>
                      <span className={`text-base font-semibold ${i.atual?.preco != null ? "text-slate-900" : "text-slate-300"}`}>
                        {i.atual?.preco != null ? `US$ ${(i.atual.preco * i.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {l.itens.length > 0 && (
              <footer className="border-t border-slate-100 bg-slate-50 px-4 py-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">{textos.total}</span>
                  <span className="text-2xl font-bold text-slate-900">
                    US$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {semPreco > 0 && (
                  <p className="mt-1 text-right text-xs text-amber-600">
                    {semPreco} {semPreco === 1 ? textos.foraDoArUm : textos.foraDoArVarios}
                  </p>
                )}

                {/* A COTA — a ideia que faz esta lista valer para o público do
                    iCompras. Quem atravessa a ponte tem US$ 500 na cabeça, e
                    nenhum comparador genérico mostra isso.
                    ⚠ É informativo: a regra da Receita muda conforme o meio de
                    transporte e o texto diz qual caso está sendo considerado. */}
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{textos.cota}</span>
                    <span className={passou ? "font-semibold text-rose-600" : "font-medium text-slate-700"}>
                      {passou
                        ? `${textos.passou} US$ ${(total - COTA_USD).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : `${textos.aindaCabe} US$ ${(COTA_USD - total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all ${passou ? "bg-rose-500" : pctCota > 80 ? "bg-amber-400" : "bg-brand-green"}`}
                      style={{ width: `${Math.min(100, pctCota)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">{textos.cotaNota}</p>
                </div>
              </footer>
            )}
          </section>
        );
      })}

      <button
        onClick={() => criarLista(textos.novaPadrao)}
        className="w-full rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-brand-green hover:text-brand-green-dark"
      >
        + {textos.criar}
      </button>
    </div>
  );
}
