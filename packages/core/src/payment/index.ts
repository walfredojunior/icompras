// Camada de pagamento configurável (Bancard / Pagopar). A aplicação chama esta
// interface; o gateway ativo vem de PAYMENT_PROVIDER.

export interface CreateSubscriptionInput {
  storeId: number;
  planId: number;
  amount: number;
  currency: string; // 'PYG'
  customerEmail?: string;
  returnUrl?: string;
}
export interface CreateSubscriptionResult {
  providerSubscriptionId: string;
  checkoutUrl?: string;
}
export interface PaymentEvent {
  type: 'paid' | 'failed' | 'canceled' | 'unknown';
  providerSubscriptionId?: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  /** Interpreta o webhook do gateway e normaliza em um PaymentEvent. */
  parseWebhook(payload: unknown, headers: Record<string, string>): Promise<PaymentEvent>;
}

/** Stub Bancard — implementação real na Fase 7 (VPOS / API de pagos recorrentes). */
class BancardProvider implements PaymentProvider {
  readonly name = 'bancard';
  async createSubscription(): Promise<CreateSubscriptionResult> {
    throw new Error('BancardProvider.createSubscription: a implementar na Fase 7.');
  }
  async cancelSubscription(): Promise<void> {
    throw new Error('BancardProvider.cancelSubscription: a implementar na Fase 7.');
  }
  async parseWebhook(): Promise<PaymentEvent> {
    throw new Error('BancardProvider.parseWebhook: a implementar na Fase 7.');
  }
}

/** Stub Pagopar — implementação real na Fase 7. */
class PagoparProvider implements PaymentProvider {
  readonly name = 'pagopar';
  async createSubscription(): Promise<CreateSubscriptionResult> {
    throw new Error('PagoparProvider.createSubscription: a implementar na Fase 7.');
  }
  async cancelSubscription(): Promise<void> {
    throw new Error('PagoparProvider.cancelSubscription: a implementar na Fase 7.');
  }
  async parseWebhook(): Promise<PaymentEvent> {
    throw new Error('PagoparProvider.parseWebhook: a implementar na Fase 7.');
  }
}

/** Provedor manual (dev): não cobra de verdade, ativa a assinatura direto. */
class ManualPaymentProvider implements PaymentProvider {
  readonly name = "manual";
  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    return { providerSubscriptionId: `manual-${input.storeId}-${input.planId}`, checkoutUrl: undefined };
  }
  async cancelSubscription(): Promise<void> {}
  async parseWebhook(payload: unknown): Promise<PaymentEvent> {
    return { type: "paid", raw: payload };
  }
}

const REGISTRY: Record<string, () => PaymentProvider> = {
  manual: () => new ManualPaymentProvider(),
  bancard: () => new BancardProvider(),
  pagopar: () => new PagoparProvider(),
};

export function getPaymentProvider(): PaymentProvider {
  const key = process.env.PAYMENT_PROVIDER ?? 'bancard';
  const factory = REGISTRY[key];
  if (!factory) throw new Error(`PAYMENT_PROVIDER desconhecido: "${key}". Opções: ${Object.keys(REGISTRY).join(', ')}`);
  return factory();
}
