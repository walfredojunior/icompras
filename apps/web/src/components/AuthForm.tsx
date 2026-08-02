"use client";

import { useState } from "react";

export interface AuthDict {
  email: string;
  password: string;
  name: string;
  submit: string;
  switchText: string;
  switchLink: string;
}

export function AuthForm({
  mode,
  dict,
  switchHref,
  endpoint,
  redirectTo = "/",
}: {
  mode: "login" | "register";
  dict: AuthDict;
  switchHref: string;
  endpoint?: string;
  redirectTo?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const url = endpoint ?? (mode === "login" ? "/api/auth/login" : "/api/auth/register");
    const body = mode === "login" ? { email, password } : { email, password, name };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      // Redirecionamento direto (mais confiável no celular que router.push).
      // Preserva o idioma atual da URL (ex.: /es/... -> /es/admin).
      const seg = window.location.pathname.split("/")[1];
      const prefix = ["pt-BR", "es", "en"].includes(seg) ? `/${seg}` : "";
      window.location.href = `${prefix}${redirectTo}`;
      return;
    } else {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Erro");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "register" && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={dict.name}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-brand-green"
        />
      )}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={dict.email}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="username"
        inputMode="email"
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-brand-green"
      />
      <input
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={dict.password}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="current-password"
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-brand-green"
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        disabled={loading}
        className="w-full rounded-lg bg-brand-green px-4 py-2.5 font-medium text-white hover:bg-brand-green-dark disabled:opacity-60"
      >
        {dict.submit}
      </button>
      <p className="text-center text-sm text-slate-500">
        {dict.switchText}{" "}
        <a href={switchHref} className="font-medium text-brand-green-dark hover:underline">
          {dict.switchLink}
        </a>
      </p>
    </form>
  );
}
