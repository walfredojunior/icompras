import type { Rates } from "./rates";

const LOCALE_MAP: Record<string, string> = { "pt-BR": "pt-BR", es: "es-PY", en: "en-US" };

// A partir de um valor em USD (base), calcula BRL e PYG usando o câmbio.
// Converte um valor em outra moeda para USD (base).
export function toUsd(amount: number, currency: string, rates: Rates): number {
  const pc = rates[currency] ?? (currency === "PYG" ? 1 : null);
  const pu = rates.USD;
  if (!pc || !pu) return amount;
  return (amount * pc) / pu;
}

export function fromUsd(usd: number, rates: Rates): { usd: number; brl: number; pyg: number } {
  const pygPerUsd = rates.USD ?? 6030;
  const pygPerBrl = rates.BRL ?? 1170;
  const pyg = usd * pygPerUsd;
  const brl = pygPerBrl ? pyg / pygPerBrl : usd;
  return { usd, brl, pyg };
}

const SYMBOLS: Record<"USD" | "BRL" | "PYG", string> = { USD: "US$", BRL: "R$", PYG: "₲" };

export function fmt(value: number, currency: "USD" | "BRL" | "PYG", locale: string): string {
  const decimals = currency === "PYG" ? 0 : 2;
  try {
    const num = new Intl.NumberFormat(LOCALE_MAP[locale] ?? "es-PY", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
    return `${SYMBOLS[currency]} ${num}`;
  } catch {
    return `${SYMBOLS[currency]} ${value}`;
  }
}
