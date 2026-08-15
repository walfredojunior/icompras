"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

/** Criar a senha nova, com o token que veio no link do e-mail. */
export function FormNovaSenha({ token, textos }: { token: string; textos: Record<string, string> }) {
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha !== repete) return setErro(textos.naoConfere);
    if (senha.length < 8) return setErro(textos.curta);

    setSalvando(true);
    try {
      const r = await fetch("/api/auth/redefinir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const d = await r.json();
      if (d.ok) { window.location.href = "/"; return; }
      setErro(d.erro === "senha-curta" ? textos.curta : textos.linkInvalido);
    } catch {
      setErro(textos.linkInvalido);
    }
    setSalvando(false);
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div>
        <label htmlFor="s1" className="block text-sm font-medium text-slate-700">{textos.novaSenha}</label>
        <input id="s1" type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-brand-green focus:outline-none" />
        <p className="mt-1 text-xs text-slate-500">{textos.minimo}</p>
      </div>
      <div>
        <label htmlFor="s2" className="block text-sm font-medium text-slate-700">{textos.repetir}</label>
        <input id="s2" type="password" required value={repete} onChange={(e) => setRepete(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-brand-green focus:outline-none" />
      </div>
      {erro && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}
      <button type="submit" disabled={salvando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 font-medium text-white disabled:opacity-60">
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {textos.salvar}
      </button>
    </form>
  );
}
