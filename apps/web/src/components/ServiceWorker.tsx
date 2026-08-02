"use client";

import { useEffect } from "react";

// Registra o service worker (public/sw.js). É ele que faz o navegador
// reconhecer o site como aplicativo instalável e guardar os arquivos internos
// em cache, deixando as visitas seguintes mais rápidas.
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sem service worker o site funciona igual, só não instala */
    });
  }, []);
  return null;
}
