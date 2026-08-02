import { createHash } from "node:crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Credenciais de comerciante Bancard (só ativa se preenchidas no .env).
const PUBLIC = process.env.BANCARD_PUBLIC_KEY ?? "";
const PRIVATE = process.env.BANCARD_PRIVATE_KEY ?? "";
const ENV = (process.env.BANCARD_ENV ?? "staging").toLowerCase();

// Bases oficiais: produção sem porta; homologação (staging) na 8888.
const BASE = ENV === "production" ? "https://vpos.infonet.com.py" : "https://vpos.infonet.com.py:8888";

export function bancardConfigured(): boolean {
  return !!(PUBLIC && PRIVATE);
}

export function bancardCheckoutJs(): string {
  return `${BASE}/checkout/javascript/dist/bancard-checkout-4.0.0.js`;
}

function md5(s: string): string {
  return createHash("md5").update(s).digest("hex");
}

// single_buy: cria a operação de pagamento e devolve o process_id do Bancard.
export async function bancardSingleBuy(params: {
  shopProcessId: number;
  amount: number;
  currency: string; // 'USD' | 'PYG'
  description: string;
  returnUrl: string;
}): Promise<string> {
  const amount = params.amount.toFixed(2);
  const token = md5(`${PRIVATE}${params.shopProcessId}${amount}${params.currency}`);
  const body = {
    public_key: PUBLIC,
    operation: {
      token,
      shop_process_id: params.shopProcessId,
      amount,
      currency: params.currency,
      additional_data: "",
      description: params.description.slice(0, 40),
      return_url: params.returnUrl,
      cancel_url: params.returnUrl,
    },
  };
  const res = await fetch(`${BASE}/vpos/api/0.3/single_buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j: any = await res.json().catch(() => ({}));
  if (j.status !== "success" || !j.process_id) {
    throw new Error(j.messages?.[0]?.dsc ?? "Falha ao criar pagamento no Bancard.");
  }
  return String(j.process_id);
}

// Verifica o token do webhook de confirmação do Bancard.
export function bancardVerifyConfirm(payload: any): { valid: boolean; approved: boolean; shopProcessId: number | null } {
  const op = payload?.operation;
  if (!op) return { valid: false, approved: false, shopProcessId: null };
  const expected = md5(`${PRIVATE}${op.shop_process_id}confirm${op.amount}${op.currency}`);
  const valid = op.token === expected;
  const approved = op.response === "S" || op.response_code === "00";
  return { valid, approved, shopProcessId: op.shop_process_id != null ? Number(op.shop_process_id) : null };
}
