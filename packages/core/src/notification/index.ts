// Camada de notificação configurável (e-mail / WhatsApp), usada pelos alertas de preço.

export interface NotificationMessage {
  to: string;
  subject?: string; // usado por e-mail
  body: string;
}

export interface NotificationProvider {
  readonly channel: "email" | "whatsapp";
  send(msg: NotificationMessage): Promise<void>;
}

/** Provedor de log (dev): não envia de verdade, apenas registra no console. */
class LogNotificationProvider implements NotificationProvider {
  constructor(readonly channel: "email" | "whatsapp") {}
  async send(msg: NotificationMessage): Promise<void> {
    console.log(`[NOTIFY:${this.channel}] -> ${msg.to} :: ${msg.subject ?? ""} — ${msg.body}`);
  }
}

/** Stub e-mail real — implementação futura (SMTP / Resend / SES). */
class EmailProvider implements NotificationProvider {
  readonly channel = "email" as const;
  async send(): Promise<void> {
    throw new Error("EmailProvider.send: requer credenciais SMTP/Resend/SES (a configurar).");
  }
}

/** Stub WhatsApp real — implementação futura (WhatsApp Cloud API). */
class WhatsAppProvider implements NotificationProvider {
  readonly channel = "whatsapp" as const;
  async send(): Promise<void> {
    throw new Error("WhatsAppProvider.send: requer credenciais da WhatsApp Cloud API (a configurar).");
  }
}

export function getNotificationProvider(channel: "email" | "whatsapp"): NotificationProvider {
  const configured =
    channel === "whatsapp"
      ? process.env.WHATSAPP_PROVIDER ?? "log"
      : process.env.EMAIL_PROVIDER ?? "log";

  if (configured === "log") return new LogNotificationProvider(channel);
  return channel === "whatsapp" ? new WhatsAppProvider() : new EmailProvider();
}
