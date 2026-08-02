import type { MetadataRoute } from "next";

// Manifesto do app (PWA): é o que permite "instalar" o iCompras na tela do
// celular. Fica fora de [locale] de propósito — é um arquivo único do site,
// servido em /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "iCompras — Comparador de precios del Paraguay",
    short_name: "iCompras",
    description: "Compará precios de las mejores tiendas del Paraguay.",
    // "/" cai no idioma do visitante (o site redireciona sozinho).
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#123a5e",
    lang: "es",
    dir: "ltr",
    categories: ["shopping", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // O Android recorta o ícone em círculo; esta versão tem margem para isso.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
