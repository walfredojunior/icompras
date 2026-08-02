"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X, House, Store, TrendingDown, Heart, Bell, LogOut } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";

interface Labels {
  home: string;
  stores: string;
  favorites: string;
  alerts: string;
  drops: string;
  login: string;
  register: string;
  logout: string;
}

export function MobileMenu({ user, labels }: { user: string | null; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Só renderiza o drawer no cliente (evita qualquer diferença de hidratação).
  useEffect(() => setMounted(true), []);

  // Trava o scroll do fundo enquanto o menu está aberto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => setOpen(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    close();
    router.push("/");
    router.refresh();
  }

  // Ícone + texto em cada item. No celular o menu é lido de relance e com o
  // polegar: o desenho identifica a linha antes de a pessoa terminar de ler,
  // e o alvo de toque fica maior.
  const linkCls =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base text-slate-700 transition hover:bg-slate-50 hover:text-brand-navy";
  const iconCls = "h-5 w-5 shrink-0 text-slate-400";

  const drawer = (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-wordmark.png" alt="iCompras" className="h-6 w-auto" />
          <button
            onClick={close}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <Link href="/" onClick={close} className={linkCls}>
            <House className={iconCls} />
            {labels.home}
          </Link>
          <Link href="/lojas" onClick={close} className={linkCls}>
            <Store className={iconCls} />
            {labels.stores}
          </Link>
          {/* Fixo, como no cabeçalho do computador: é a página que muda todo dia.
              Único item colorido do menu — e o ícone acompanha, senão o verde
              sozinho parece só um link "errado". */}
          <Link href="/quedas" onClick={close} className={`${linkCls} font-medium text-brand-green-dark`}>
            <TrendingDown className="h-5 w-5 shrink-0 text-brand-green-dark" />
            {labels.drops}
          </Link>
          {user ? (
            <>
              <Link href="/favoritos" onClick={close} className={linkCls}>
                <Heart className={iconCls} />
                {labels.favorites}
              </Link>
              <Link href="/alertas" onClick={close} className={linkCls}>
                <Bell className={iconCls} />
                {labels.alerts}
              </Link>
              <button onClick={logout} className={`${linkCls} w-full text-left`}>
                <LogOut className={iconCls} />
                {labels.logout}
              </button>
            </>
          ) : null}
          {/* CONTA DESLIGADA (2026-07-31) — ver o porquê no Header.tsx.
              As páginas continuam de pé; só não são anunciadas.

          <>
            <Link href="/entrar" onClick={close} className={linkCls}>
              {labels.login}
            </Link>
            <Link href="/cadastro" onClick={close} className={`${linkCls} font-medium text-brand-navy`}>
              {labels.register}
            </Link>
          </>
          */}
        </nav>

        <div className="border-t border-slate-100 p-3">
          {user ? <p className="mb-2 truncate px-3 text-xs text-slate-400">{user}</p> : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>
      {mounted && open ? createPortal(drawer, document.body) : null}
    </>
  );
}
