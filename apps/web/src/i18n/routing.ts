import { defineRouting } from "next-intl/routing";

// Idiomas do projeto.
// Padrão: PORTUGUÊS — o público principal é brasileiro comprando no Paraguai.
// Quem já escolheu outro idioma volta nele (cookie NEXT_LOCALE); o idioma do
// navegador é ignorado de propósito (ver src/middleware.ts).
export const routing = defineRouting({
  locales: ["pt-BR", "es", "en"],
  defaultLocale: "pt-BR",
});
