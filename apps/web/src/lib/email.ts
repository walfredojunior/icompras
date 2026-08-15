// ENVIO DE E-MAIL — pelo Resend.
//
// Serviço escolhido em 15/08/2026: grátis até 3.000 por mês (100 por dia), sem
// cartão. O uso previsto é recuperação de senha, que são poucos por dia.
//
// ⚠ A CHAVE FICA NO `.env`, NUNCA NO CÓDIGO. Ela também está anotada em
// Admin › Anotações (regra dele: "quero as senhas escritas nas páginas"), e a
// cópia da memória que vai para o GitHub filtra o padrão `re_...`.
//
// ⚠⚠ MANDAR NÃO É CHEGAR. Sem SPF, DKIM e DMARC no DNS do domínio, o e-mail
// sai daqui, o Resend confirma o envio, e ele cai no spam — a pessoa nunca
// recupera a senha e ninguém fica sabendo, porque do nosso lado deu tudo certo.
// Configurar os três registros na Cloudflare é PARTE da tarefa, não um extra.

const CHAVE = process.env.RESEND_API_KEY ?? "";
// ✅ Domínio verificado no Resend em 15/08/2026 (DKIM e SPF confirmados no
// DNS da Cloudflare), então o e-mail sai do endereço próprio. Isso importa mais
// do que parece: e-mail de recuperação de senha vindo de um domínio de teste é
// exatamente o que um golpe pareceria, e o filtro de spam concorda.
const DE = process.env.EMAIL_REMETENTE ?? "iCompras <nao-responda@icompras.com.py>";

export interface Enviado {
  ok: boolean;
  id?: string;
  erro?: string;
}

export function emailConfigurado(): boolean {
  return CHAVE.startsWith("re_");
}

export async function enviarEmail(para: string, assunto: string, html: string, texto: string): Promise<Enviado> {
  if (!emailConfigurado()) return { ok: false, erro: "sem chave configurada" };

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: DE,
        to: [para],
        subject: assunto,
        html,
        // A versão em texto puro não é enfeite: quem lê e-mail sem HTML vê
        // isto, e a ausência dela conta pontos contra na avaliação de spam.
        text: texto,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, erro: d?.message ?? `resposta ${r.status}` };
    return { ok: true, id: d?.id };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

/**
 * Endereço público da logo.
 *
 * ⚠ FICA EM `/media/`, NÃO NA RAIZ DE `public/`. O nginx serve `/media/` direto
 * do disco (`location /media/` → `alias .../public/media/`), então o arquivo
 * aparece assim que existe. Já a raiz de `public/` passa pelo Next, que só
 * entrega o que estava lá no momento do build — descoberto em 15/08/2026,
 * quando a logo nova dava 404 enquanto as fotos dos produtos funcionavam.
 */
const LOGO = `${process.env.SITE_URL ?? "https://icompras.com.py"}/media/marca/email-logo.png`;

/**
 * O e-mail de recuperação, nos três idiomas.
 *
 * ⚠ A LOGO É IMAGEM HOSPEDADA, e isso mudou de ideia em 15/08/2026.
 *
 * A primeira versão usava só texto estilizado, com o argumento de que
 * "programas de e-mail bloqueiam imagem por padrão". Isso era verdade **há uns
 * dez anos** — Gmail passou a mostrar imagens por padrão em 2013, e Outlook e
 * Apple Mail fazem o mesmo. Ele pediu a logo e tinha razão: um e-mail de
 * recuperação de senha sem a marca parece golpe, que é exatamente o oposto do
 * necessário.
 *
 * Os cuidados que continuam valendo:
 *   · **peso** — `email-logo.png` tem 33 KB (a logo original tem 792 KB, que
 *     num e-mail é abuso e ainda atrasa a abertura no celular)
 *   · **fundo branco, não transparente** — em tema escuro, PNG transparente
 *     com letra escura some
 *   · **`alt` de verdade** — se a imagem for bloqueada mesmo assim, o leitor vê
 *     "iCompras" no lugar, e não um quadrado vazio
 *   · **largura fixa em `width=`**, não só em CSS: Outlook ignora boa parte do
 *     CSS e desenharia a imagem no tamanho original
 */
export function montarEmailDeRecuperacao(link: string, locale: string) {
  const t = {
    "pt-BR": {
      assunto: "Recuperar sua senha no iCompras",
      ola: "Olá!",
      texto: "Recebemos um pedido para trocar a senha da sua conta no iCompras.",
      botao: "Criar uma senha nova",
      validade: "Este link vale por 1 hora e só pode ser usado uma vez.",
      naoFoi: "Se não foi você que pediu, pode ignorar este e-mail — sua senha continua a mesma.",
      rodape: "iCompras — compare preços das melhores lojas do Paraguai",
    },
    es: {
      assunto: "Recuperar tu contraseña en iCompras",
      ola: "¡Hola!",
      texto: "Recibimos un pedido para cambiar la contraseña de tu cuenta en iCompras.",
      botao: "Crear una contraseña nueva",
      validade: "Este enlace vale por 1 hora y solo puede usarse una vez.",
      naoFoi: "Si no fuiste vos, podés ignorar este correo — tu contraseña sigue igual.",
      rodape: "iCompras — compará precios de las mejores tiendas del Paraguay",
    },
    en: {
      assunto: "Reset your iCompras password",
      ola: "Hello!",
      texto: "We received a request to change the password for your iCompras account.",
      botao: "Create a new password",
      validade: "This link is valid for 1 hour and can only be used once.",
      naoFoi: "If this wasn't you, just ignore this email — your password stays the same.",
      rodape: "iCompras — compare prices from the best stores in Paraguay",
    },
  }[locale === "es" ? "es" : locale === "en" ? "en" : "pt-BR"];

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="padding:26px 28px 6px">
      <img src="${LOGO}" alt="iCompras" width="150" style="display:block;width:150px;max-width:150px;height:auto;border:0" />
    </td></tr>
    <tr><td style="padding:8px 28px 0">
      <p style="margin:0 0 12px;font-size:16px;color:#0f172a">${t.ola}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569">${t.texto}</p>
      <a href="${link}" style="display:inline-block;background:#123a5e;color:#fff;text-decoration:none;padding:13px 26px;border-radius:12px;font-size:15px;font-weight:600">${t.botao}</a>
      <p style="margin:20px 0 0;font-size:13px;color:#64748b">${t.validade}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b">${t.naoFoi}</p>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;word-break:break-all">${link}</p>
    </td></tr>
    <tr><td style="padding:24px 28px 28px">
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 12px">
      <p style="margin:0;font-size:12px;color:#94a3b8">${t.rodape}</p>
    </td></tr>
  </table>
</body></html>`;

  const texto = `${t.ola}\n\n${t.texto}\n\n${t.botao}: ${link}\n\n${t.validade}\n${t.naoFoi}\n\n${t.rodape}`;
  return { assunto: t.assunto, html, texto };
}
