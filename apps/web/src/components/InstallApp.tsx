"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

// Convite para instalar o iCompras na tela do celular.
//
// Android/Chrome: o navegador avisa que dá para instalar (evento
// beforeinstallprompt) e nós mostramos um botão que abre a instalação.
// iPhone: a Apple não deixa esse convite aparecer, então explicamos os dois
// toques (Compartilhar → Adicionar à Tela de Início).
// Em ambos os casos: some se já estiver instalado e some se a pessoa fechar.

const CHAVE = "icompras-instalar-dispensado";

const TEXTOS: Record<string, Record<string, string>> = {
  "pt-BR": {
    titulo: "Instale o iCompras no seu celular",
    descAndroid: "Acesso rápido pela tela inicial, sem ocupar espaço.",
    descIos: "Toque em Compartilhar e depois em “Adicionar à Tela de Início”.",
    botao: "Instalar",
    fechar: "Fechar",
  },
  es: {
    titulo: "Instalá iCompras en tu celular",
    descAndroid: "Acceso rápido desde la pantalla de inicio, sin ocupar espacio.",
    descIos: "Tocá Compartir y luego “Agregar a inicio”.",
    botao: "Instalar",
    fechar: "Cerrar",
  },
  en: {
    titulo: "Install iCompras on your phone",
    descAndroid: "Quick access from your home screen, without taking up space.",
    descIos: "Tap Share, then “Add to Home Screen”.",
    botao: "Install",
    fechar: "Close",
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export function InstallApp({ locale }: { locale: string }) {
  const t = TEXTOS[locale] ?? TEXTOS["pt-BR"];
  const [prompt, setPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(CHAVE)) return;

    // Já está aberto como app instalado: não convidar.
    const instalado =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    if (instalado) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) {
      setIsIos(true);
      setVisivel(true);
      return;
    }

    const aoPoderInstalar = (e: Event) => {
      e.preventDefault(); // guardamos para disparar no clique do botão
      setPrompt(e);
      setVisivel(true);
    };
    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", () => setVisivel(false));
    return () => window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
  }, []);

  if (!visivel) return null;

  function dispensar() {
    localStorage.setItem(CHAVE, "1");
    setVisivel(false);
  }

  async function instalar() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    setVisivel(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm sm:rounded-2xl sm:border">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl border border-slate-200" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{t.titulo}</p>
          {isIos ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-slate-500">
              <Share className="h-3.5 w-3.5 shrink-0" />
              <Plus className="h-3.5 w-3.5 shrink-0" />
              {t.descIos}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">{t.descAndroid}</p>
          )}
        </div>
        <button
          onClick={dispensar}
          aria-label={t.fechar}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {!isIos && (
        <button
          onClick={instalar}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white hover:bg-brand-green-dark"
        >
          <Download className="h-4 w-4" />
          {t.botao}
        </button>
      )}
    </div>
  );
}
