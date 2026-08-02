const LOCALE_MAP: Record<string, string> = {
  "pt-BR": "pt-BR",
  es: "es-PY",
  en: "en-US",
};

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
