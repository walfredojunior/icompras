"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Anotacao } from "@/lib/anotacoes";

// EDITOR DAS ANOTAÇÕES.
//
// Feito para quem não é técnico: cada bloco aparece como texto normal e vira
// caixa de edição ao clicar em "Editar". Sem formatação especial, sem markdown,
// sem nada para aprender — o que ele digitar é exatamente o que aparece.
//
// As quebras de linha são preservadas (`whitespace-pre-wrap`), então listas e
// alinhamento com espaços continuam como ele escreveu.

export function AnotacoesEditor({ inicial }: { inicial: Anotacao[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<number | "nova" | null>(null);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const abrir = (a?: Anotacao) => {
    setEditando(a ? a.id : "nova");
    setTitulo(a?.titulo ?? "");
    setConteudo(a?.conteudo ?? "");
  };

  const fechar = () => {
    setEditando(null);
    setTitulo("");
    setConteudo("");
  };

  async function salvar() {
    setSalvando(true);
    try {
      await fetch("/api/admin/anotacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editando === "nova" ? undefined : editando, titulo, conteudo }),
      });
      fechar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(id: number) {
    // Confirmação simples: apagar anotação de servidor por engano custa caro.
    if (!confirm("Apagar esta anotação? Não dá para desfazer.")) return;
    await fetch("/api/admin/anotacoes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  const campo =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-green focus:outline-none";

  const Formulario = () => (
    <div className="rounded-2xl border-2 border-brand-green/40 bg-white p-5">
      <input
        className={`${campo} mb-3 font-semibold`}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título (ex.: Servidor principal — Hostinger)"
        autoFocus
      />
      <textarea
        className={`${campo} min-h-[16rem] font-mono text-[13px] leading-relaxed`}
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
        placeholder={"Escreva do jeito que quiser.\nAs quebras de linha são mantidas."}
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar
        </button>
        <button
          type="button"
          onClick={fechar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {inicial.map((a) =>
        editando === a.id ? (
          <Formulario key={a.id} />
        ) : (
          <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h2 className="font-semibold text-slate-900">{a.titulo}</h2>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => abrir(a)}
                  title="Editar"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-navy"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => apagar(a.id)}
                  title="Apagar"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* pre-wrap: o texto sai exatamente como ele digitou, com as
                quebras de linha e o alinhamento preservados. */}
            <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-slate-700">
              {a.conteudo}
            </pre>
          </div>
        ),
      )}

      {editando === "nova" ? (
        <Formulario />
      ) : (
        <button
          type="button"
          onClick={() => abrir()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-500 transition hover:border-brand-green hover:text-brand-green-dark"
        >
          <Plus className="h-4 w-4" />
          Nova anotação
        </button>
      )}
    </div>
  );
}
