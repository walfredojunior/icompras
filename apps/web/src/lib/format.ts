const LOCALE_MAP: Record<string, string> = {
  "pt-BR": "pt-BR",
  es: "es-PY",
  en: "en-US",
};

/**
 * Formata número numa língua que pode não ser válida — sem estourar.
 *
 * ⚠ ISTO NÃO É PRECAUÇÃO TEÓRICA. `RangeError: Incorrect locale information
 * provided` apareceu **387 vezes** no registro do servidor até 11/08/2026, e
 * era uma pista aberta desde 04/08, quando o site ficou 1 hora fora do ar.
 * O rastro terminava em `Number.toLocaleString` dentro de um `.map` — os
 * blocos "Mais procurados" da home (`CategoryBlocks`).
 *
 * A causa: a língua vem do endereço da página (`/pt-BR/`, `/es/`, `/en/`) e é
 * repassada direto ao `toLocaleString`. Basta a página ser servida com algo
 * que não seja uma dessas três — e `toLocaleString("")` estoura na hora — para
 * o componente inteiro morrer no meio da renderização.
 *
 * Formatar número é enfeite: **nunca deve derrubar a tela**. Se a língua não
 * presta, mostra o número do mesmo jeito e segue.
 */
export function numeroLocal(n: number, locale?: string, opcoes?: Intl.NumberFormatOptions): string {
  try {
    return n.toLocaleString(LOCALE_MAP[locale ?? ""] ?? locale ?? "pt-BR", opcoes);
  } catch {
    // Língua inválida: tenta o padrão da casa; se nem isso, devolve cru.
    try {
      return n.toLocaleString("pt-BR", opcoes);
    } catch {
      return String(n);
    }
  }
}

export function formatPrice(price: number | null, currency = "PYG", locale = "es"): string {
  if (price == null) return "—";
  try {
    return new Intl.NumberFormat(LOCALE_MAP[locale] ?? "es-PY", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "PYG" ? 0 : 2,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}
