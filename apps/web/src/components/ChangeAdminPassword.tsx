"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff, Check } from "lucide-react";

const MINIMO = 10;

export function ChangeAdminPassword({ email }: { email: string }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const curta = nova.length > 0 && nova.length < MINIMO;
  const diferente = confirmacao.length > 0 && nova !== confirmacao;
  const podeSalvar = atual && nova.length >= MINIMO && nova === confirmacao && !salvando;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atual, nova, confirmacao }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Não deu para trocar a senha.");
      setPronto(true);
      setAtual("");
      setNova("");
      setConfirmacao("");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-green focus:outline-none";

  return (
    <div className="max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand-navy" />
          <h2 className="font-semibold text-slate-900">Trocar minha senha</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Entrando como <span className="font-medium text-slate-700">{email}</span>
        </p>

        {pronto ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-green bg-brand-green-light p-4">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-brand-green-dark" />
            <div className="text-sm text-brand-green-dark">
              <p className="font-semibold">Senha trocada.</p>
              <p className="mt-1">
                Guarde a nova senha num lugar seguro — não existe recuperação por e-mail. Sua sessão atual
                continua aberta; o novo valor vale a partir do próximo login.
              </p>
              <button onClick={() => setPronto(false)} className="mt-3 text-xs underline">
                trocar de novo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={salvar} className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="text-slate-600">Senha atual</span>
              <input
                type={mostrar ? "text" : "password"}
                className={campo}
                value={atual}
                onChange={(e) => setAtual(e.target.value)}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>

            <label className="block text-sm">
              <span className="text-slate-600">Nova senha</span>
              <input
                type={mostrar ? "text" : "password"}
                className={campo}
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <span className={`mt-1 block text-xs ${curta ? "text-amber-600" : "text-slate-400"}`}>
                {curta ? `Faltam ${MINIMO - nova.length} caractere(s).` : `Mínimo de ${MINIMO} caracteres.`}
              </span>
            </label>

            <label className="block text-sm">
              <span className="text-slate-600">Repita a nova senha</span>
              <input
                type={mostrar ? "text" : "password"}
                className={campo}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {diferente && <span className="mt-1 block text-xs text-amber-600">As duas não estão iguais.</span>}
            </label>

            <button
              type="button"
              onClick={() => setMostrar((m) => !m)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-navy"
            >
              {mostrar ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {mostrar ? "esconder senhas" : "mostrar senhas"}
            </button>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="submit"
              disabled={!podeSalvar}
              className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-green-dark disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Trocar senha"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        Não há recuperação por e-mail: o endereço do administrador é apenas um identificador. Se a senha for
        perdida, ela precisa ser redefinida direto no servidor.
      </p>
    </div>
  );
}
