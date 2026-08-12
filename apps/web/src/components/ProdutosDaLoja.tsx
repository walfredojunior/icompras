"use client";

import { useMemo, useState } from "react";
import { Search, Check, X, Undo2, ImageOff, Save, Upload } from "lucide-react";
import type { ProdutoDaLoja, Aba } from "@/lib/produtosDaLoja";

// A tela da loja para revisar e liberar os próprios produtos (migração 054).
//
// Ideia dele (11/08/2026): "um módulo de produto do cliente que eu passe um
// acesso pra ele poder procurar e editar os produtos dele, colocar foto e
// descrição, e daí ir liberando. E podia ter uma aba produtos que falta e
// produto que já tem tudo certinho, e o que não entra na lista deixa em outra".
//
// 💡 O QUE FALTA VEM ESCRITO EM CADA LINHA. Sem isso, a loja abre trezentos
// produtos um a um para descobrir qual é o problema de cada um — que é o que
// faz uma tela dessas ser abandonada na primeira semana.

const ABAS: Array<{ id: Aba; nome: string; dica: string }> = [
  { id: "faltando", nome: "Faltando", dica: "Precisam de foto, descrição ou ficha antes de ir ao ar." },
  { id: "prontos", nome: "Prontos para liberar", dica: "Completos. É só liberar e eles aparecem no iCompras." },
  { id: "no-ar", nome: "No ar", dica: "Já aparecem para quem visita o site." },
  { id: "fora", nome: "Fora da lista", dica: "Você marcou para não publicar. Dá para voltar atrás quando quiser." },
];

const campo = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function ProdutosDaLoja({ inicial, analiseAtiva }: { inicial: ProdutoDaLoja[]; analiseAtiva: boolean }) {
  const [itens, setItens] = useState(inicial);
  const [aba, setAba] = useState<Aba>("faltando");
  const [busca, setBusca] = useState("");
  const [abrindo, setAbrindo] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const porAba = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const filtrados = t ? itens.filter((i) => i.nome.toLowerCase().includes(t)) : itens;
    return {
      faltando: filtrados.filter((i) => i.estado === "faltando"),
      prontos: filtrados.filter((i) => i.estado === "prontos"),
      "no-ar": filtrados.filter((i) => i.estado === "no-ar"),
      fora: filtrados.filter((i) => i.estado === "fora"),
    } as Record<Aba, ProdutoDaLoja[]>;
  }, [itens, busca]);

  async function agir(offerId: number, acao: string, extra: Record<string, unknown> = {}) {
    setErro(null);
    const r = await fetch("/api/store/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, offerId, ...extra }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(j.error ?? "não consegui salvar");
      return false;
    }
    return true;
  }

  function atualizar(offerId: number, mudanca: Partial<ProdutoDaLoja>) {
    setItens((antes) =>
      antes.map((i) => {
        if (i.offerId !== offerId) return i;
        const novo = { ...i, ...mudanca };
        // Recalcula o que falta e o estado, para o item pular de aba na hora.
        const falta: string[] = [];
        if (!novo.foto) falta.push("foto");
        if (!novo.descricao || novo.descricao.trim().length < 20) falta.push("descrição");
        if (!novo.ficha.length) falta.push("ficha técnica");
        novo.falta = falta;
        if (novo.estado !== "no-ar" && novo.estado !== "fora") {
          novo.estado = falta.length ? "faltando" : "prontos";
        }
        return novo;
      }),
    );
  }

  return (
    <div>
      {!analiseAtiva && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          A análise de produtos está <strong>desligada</strong> para a sua loja: tudo o que você envia vai
          direto para o site. Você ainda pode completar foto e descrição por aqui — e o iCompras mostra
          produto com foto muito mais vezes que sem.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              aba === a.id
                ? "border-brand-green font-semibold text-brand-green-dark"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {a.nome}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
              {porAba[a.id].length}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">{ABAS.find((a) => a.id === aba)?.dica}</p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar pelo nome do produto…"
          className={`w-full pl-9 ${campo}`}
        />
      </div>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      <div className="mt-4 space-y-2">
        {porAba[aba].length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nada por aqui.</p>}

        {porAba[aba].map((p) => (
          <div key={p.offerId} className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                {p.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto} alt="" className="h-full w-full object-contain" />
                ) : (
                  <ImageOff className="h-5 w-5 text-slate-300" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{p.nome}</p>
                <p className="text-xs text-slate-500">
                  {p.preco != null ? `${p.moeda} ${p.preco.toLocaleString("pt-BR")}` : "sem preço"}
                  {p.falta.length > 0 && (
                    <span className="ml-2 text-amber-600">falta {p.falta.join(", ")}</span>
                  )}
                  {p.compartilhado && (
                    <span className="ml-2 text-slate-400">· também vendido por outra loja</span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setAbrindo(abrindo === p.offerId ? null : p.offerId)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300"
                >
                  {abrindo === p.offerId ? "fechar" : "editar"}
                </button>

                {p.estado === "prontos" && (
                  <button
                    onClick={async () => {
                      if (await agir(p.offerId, "liberar")) atualizar(p.offerId, { estado: "no-ar" });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-green-dark"
                  >
                    <Check className="h-3.5 w-3.5" /> liberar
                  </button>
                )}

                {p.estado !== "fora" ? (
                  <button
                    onClick={async () => {
                      if (await agir(p.offerId, "excluir")) atualizar(p.offerId, { estado: "fora" });
                    }}
                    title="não publicar este produto"
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-slate-300 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (await agir(p.offerId, "devolver"))
                        atualizar(p.offerId, { estado: p.falta.length ? "faltando" : "prontos" });
                    }}
                    title="voltar para a lista"
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-slate-300 hover:text-slate-700"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {abrindo === p.offerId && (
              <Editor
                produto={p}
                onSalvar={async (d) => {
                  if (await agir(p.offerId, "salvar", d)) {
                    atualizar(p.offerId, d as Partial<ProdutoDaLoja>);
                    setAbrindo(null);
                  }
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Editor({
  produto,
  onSalvar,
}: {
  produto: ProdutoDaLoja;
  onSalvar: (d: { foto: string | null; descricao: string | null; ficha: Array<{ k: string; v: string }> }) => void;
}) {
  const [foto, setFoto] = useState(produto.foto ?? "");
  const [descricao, setDescricao] = useState(produto.descricao ?? "");
  const [ficha, setFicha] = useState(produto.ficha.length ? produto.ficha : [{ k: "", v: "" }]);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [pensando, setPensando] = useState<string | null>(null);
  const [avisoPyia, setAvisoPyia] = useState<string | null>(null);
  const [erroPyia, setErroPyia] = useState<string | null>(null);

  async function pedirPyia(acao: string) {
    setPensando(acao);
    setErroPyia(null);
    setAvisoPyia(null);
    const r = await fetch("/api/store/pyia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // A foto vai junto: se o cliente acabou de enviar uma e ainda nao salvou,
      // e ELA que ele quer melhorar, nao a que esta gravada no banco.
      body: JSON.stringify({ acao, offerId: produto.offerId, foto: foto || undefined }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setPensando(null);
    if (!r?.ok) return setErroPyia(j?.error ?? "a PYIA não conseguiu agora");

    if (acao === "descricao") {
      setDescricao(j.texto);
      setAvisoPyia("Descrição escrita pela PYIA — leia e corrija antes de salvar.");
    } else if (acao === "melhorar-foto") {
      setFoto(j.url);
      setAvisoPyia(
        j.mudou
          ? "Pronto: sobra recortada e fundo branco. O produto não foi alterado."
          : "Fundo deixado branco. Não havia moldura para recortar — se o fundo for bagunçado, isto não resolve.",
      );
    } else {
      setFoto(j.url);
      setAvisoPyia(
        acao === "foto-catalogo"
          ? `Foto tirada do nosso catálogo (de "${j.deQuem}"). Confira se é o mesmo produto.`
          : "Foto criada pela PYIA — é uma ilustração, não a foto real do produto.",
      );
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 p-4">
      {produto.compartilhado && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ Este produto também é vendido por outra loja, então a página é a mesma para todas. Você pode
          <strong> preencher o que está em branco</strong>, mas não alterar o que já foi escrito.
        </p>
      )}

      {/* FOTO — arquivo do computador PRIMEIRO, endereço depois.
          Ele notou que faltava o upload, e tinha razão: o cliente que este
          módulo atende é justamente o que não tem foto em lugar nenhum da
          internet. Ele tem o arquivo na máquina. O campo de endereço fica
          como segunda opção, para quem já hospeda as fotos em outro lugar. */}
      <div className="flex items-start gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImageOff className="h-6 w-6 text-slate-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:border-brand-green">
            <Upload className="h-4 w-4" />
            {enviando ? "Enviando…" : foto ? "Trocar a foto" : "Escolher foto do computador"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={enviando}
              onChange={async (e) => {
                const arq = e.target.files?.[0];
                if (!arq) return;
                setEnviando(true);
                setErroFoto(null);
                const fd = new FormData();
                fd.append("file", arq);
                const r = await fetch("/api/store/upload", { method: "POST", body: fd }).catch(() => null);
                const j = await r?.json().catch(() => ({}));
                setEnviando(false);
                if (!r?.ok) return setErroFoto(j?.error ?? "não consegui enviar a foto");
                setFoto(j.url);
              }}
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-400">
            JPG, PNG ou WebP, até 8 MB. A foto é reduzida e convertida automaticamente.
          </p>
          {erroFoto && <p className="mt-1 text-xs text-red-600">{erroFoto}</p>}

          <label className="mt-3 block text-xs text-slate-500">
            ou cole o endereço de uma foto que já está na internet
            <input
              value={foto}
              onChange={(e) => setFoto(e.target.value)}
              placeholder="https://…"
              className={`mt-1 block w-full ${campo}`}
            />
          </label>
        </div>
      </div>

      {/* AS AJUDAS DA PYIA.
          A ordem na tela é a ordem de qualidade, e não é acidente:
            1º  a foto que JA TEMOS   — de graça, e é a foto do produto certo
            2º  a descrição escrita   — barata, e o cliente revisa
            3º  a foto INVENTADA      — paga, e não é o produto de verdade
          Por isso a última fica em cinza e avisa o que está fazendo. */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pyia-animado.svg" alt="PYIA" className="h-5 w-5 object-contain" />
          PYIA — deixa que eu ajudo
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!pensando}
            onClick={() => pedirPyia("foto-catalogo")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-brand-green disabled:opacity-50"
          >
            {pensando === "foto-catalogo" ? "procurando…" : "Procurar a foto que já temos"}
          </button>

          {/* Melhorar vem logo depois de "procurar a foto que já temos"
              porque é o mesmo espírito: trabalha com a foto REAL. E não gasta
              nada — não passa por serviço pago nenhum. */}
          <button
            type="button"
            disabled={!!pensando || !foto}
            onClick={() => pedirPyia("melhorar-foto")}
            title={foto ? "recorta a sobra e deixa o fundo branco" : "envie uma foto primeiro"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-brand-green disabled:opacity-50"
          >
            {pensando === "melhorar-foto" ? "melhorando…" : "Melhorar a foto (fundo branco)"}
          </button>

          <button
            type="button"
            disabled={!!pensando}
            onClick={() => pedirPyia("descricao")}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-brand-green disabled:opacity-50"
          >
            {pensando === "descricao" ? "escrevendo…" : "Escrever a descrição"}
          </button>

          <button
            type="button"
            disabled={!!pensando}
            onClick={() => {
              if (!confirm("A foto será INVENTADA pela PYIA — não é a foto real do produto. Usar mesmo assim?")) return;
              pedirPyia("foto-ia");
            }}
            className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-500 hover:border-slate-400 disabled:opacity-50"
          >
            {pensando === "foto-ia" ? "criando…" : "Criar uma foto (inventada)"}
          </button>
        </div>

        {avisoPyia && <p className="mt-2 text-xs text-slate-600">{avisoPyia}</p>}
        {erroPyia && <p className="mt-2 text-xs text-red-600">{erroPyia}</p>}
      </div>

      <label className="mt-4 block text-sm text-slate-600">
        Descrição
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          placeholder="O que é o produto, para que serve, o que vem na caixa…"
          className={`mt-1 block w-full ${campo}`}
        />
        <span className="mt-1 block text-[11px] text-slate-400">Pelo menos 20 caracteres.</span>
      </label>

      <div className="mt-4">
        <p className="text-sm text-slate-600">Ficha técnica</p>
        {ficha.map((f, i) => (
          <div key={i} className="mt-1 flex gap-2">
            <input
              value={f.k}
              onChange={(e) => setFicha(ficha.map((x, j) => (i === j ? { ...x, k: e.target.value } : x)))}
              placeholder="Marca, Cor, Memória…"
              className={`w-1/3 ${campo}`}
            />
            <input
              value={f.v}
              onChange={(e) => setFicha(ficha.map((x, j) => (i === j ? { ...x, v: e.target.value } : x)))}
              placeholder="valor"
              className={`flex-1 ${campo}`}
            />
          </div>
        ))}
        <button
          onClick={() => setFicha([...ficha, { k: "", v: "" }])}
          className="mt-2 text-xs text-brand-navy hover:underline"
        >
          + acrescentar linha
        </button>
      </div>

      <button
        onClick={async () => {
          setSalvando(true);
          await onSalvar({
            foto: foto.trim() || null,
            descricao: descricao.trim() || null,
            ficha: ficha.filter((f) => f.k.trim() && f.v.trim()),
          });
          setSalvando(false);
        }}
        disabled={salvando}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
