"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

// "Esqueci minha senha" — pedir o link.
//
// ⚠ A TELA SEMPRE DIZ QUE ENVIOU, exista o e-mail ou não. Ver o comentário
// grande em /api/auth/recuperar: dizer "e-mail não cadastrado" transformaria
// esta página numa ferramenta para descobrir quem tem conta no site.
export function FormRecuperar({ locale, textos }: { locale: string; textos: Record<string, string> }) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await fetch("/api/auth/recuperar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
    } catch { /* mesmo sem rede a tela responde igual */ }
    setEnviando(false);
    setPronto(true);
  }

  if (pronto) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <p className="mt-3 font-medium text-emerald-900">{textos.enviado}</p>
        <p className="mt-1 text-sm text-emerald-700">{textos.enviadoTexto}</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">{textos.email}</label>
        <input
          id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-brand-green focus:outline-none"
        />
      </div>
      <button
        type="submit" disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {textos.enviarLink}
      </button>
      <p className="text-center text-xs text-slate-500">{textos.aviso}</p>
    </form>
  );
}
