"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { "pt-BR": "Português", es: "Español", en: "English" };
const CURTO: Record<string, string> = { "pt-BR": "PT", es: "ES", en: "EN" };

// Troca de idioma, em botões lado a lado.
//
// Fica no RODAPÉ, em todas as páginas. O site abre sempre em português
// (ver src/middleware.ts), então quem fala espanhol precisa conseguir trocar
// de onde estiver — e a maioria das visitas de um comparador entra pelo
// Google direto na página de um produto, não pela home.
// A escolha é lembrada nas próximas visitas (cookie NEXT_LOCALE).
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Idioma">
      {routing.locales.map((l) => {
        const ativo = l === locale;
        return (
          <button
            key={l}
            onClick={() => router.replace(pathname, { locale: l })}
            aria-current={ativo ? "true" : undefined}
            title={LABELS[l] ?? l}
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              ativo
                ? "bg-slate-100 font-semibold text-brand-navy"
                : "text-slate-400 hover:bg-slate-50 hover:text-brand-navy"
            }`}
          >
            {CURTO[l] ?? l}
          </button>
        );
      })}
    </div>
  );
}
