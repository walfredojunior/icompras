import { pool } from "@icompras/db";

// ALERTA POR E-MAIL — coleta parada e servidor de saída fora do ar.
//
// ⚠ POR QUE EXISTE (22/08/2026). O proxy de Dallas ficou **três dias** fora e
// ele só descobriu porque foi olhar o painel. Nesse período a fonte bloqueou o
// IP da VPS 51.841 vezes e a coleta caiu de 215 unidades por dia para 1. O
// sistema sabia de tudo isso e não contou para ninguém.
//
// 💡 O ALVO NÃO É DETECTAR — o guardião já detectava. É AVISAR sem virar spam.

/* eslint-disable @typescript-eslint/no-explicit-any */

const PARA = process.env.ALERTA_EMAIL ?? "";
const CHAVE = process.env.RESEND_API_KEY ?? "";
const DE = process.env.EMAIL_REMETENTE ?? "iCompras <nao-responda@icompras.com.py>";

/**
 * Quanto tempo o problema precisa durar antes do primeiro e-mail.
 *
 * ⚠ UMA HORA É PEDIDO DELE, e é o número certo por dois motivos: o coletor
 * volta sozinho de tropeços curtos (o proxy cai e retorna, a fonte devolve 502
 * por um minuto), e avisar disso seria ruído. Uma hora parado já é problema de
 * verdade.
 */
const ESPERA_MIN = Number(process.env.ALERTA_ESPERA_MIN) || 60;

/**
 * De quanto em quanto tempo repetir o aviso enquanto o problema continua.
 *
 * ⚠ SEM ISTO, um problema que começa sexta à noite manda UM e-mail e silencia
 * até segunda — e um único e-mail perdido no meio de outros é fácil de não ver.
 * Com 12 horas, um fim de semana inteiro rende 4 lembretes, não 864.
 */
const LEMBRETE_H = Number(process.env.ALERTA_LEMBRETE_H) || 12;

function configurado(): boolean {
  return CHAVE.startsWith("re_") && PARA.includes("@");
}

async function enviar(assunto: string, texto: string, html: string): Promise<boolean> {
  if (!configurado()) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: DE, to: [PARA], subject: assunto, html, text: texto }),
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok;
  } catch {
    // ⚠ Falha de e-mail NUNCA derruba o guardião: ele existe para vigiar o
    // coletor, e ficar sem alerta é ruim, mas ficar sem guardião é pior.
    return false;
  }
}

const dataHora = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Asuncion", dateStyle: "short", timeStyle: "short" });

/** Há quanto tempo isso dura, escrito para gente ler. */
function faz(desde: Date): string {
  const min = Math.floor((Date.now() - desde.getTime()) / 60000);
  if (min < 90) return `${min} minutos`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} horas`;
  return `${Math.floor(h / 24)} dias`;
}

/**
 * Registra que um assunto está bem ou mal, e avisa quando passa da hora.
 *
 * Chamado pelo guardião a cada verificação. Toda a decisão de "já avisei?" e
 * "já passou da hora?" mora aqui — quem chama só diz o que está vendo.
 */
export async function acompanhar(
  tipo: "coleta" | "proxy",
  ruim: boolean,
  detalhe: string,
  titulo: string,
  oQueFazer: string,
): Promise<void> {
  const [estado]: any = await pool.query("SELECT * FROM alerta_estado WHERE tipo = ?", [tipo]);
  if (!estado) return;

  const desde: Date | null = estado.ruim_desde ? new Date(estado.ruim_desde) : null;
  const avisadoEm: Date | null = estado.avisado_em ? new Date(estado.avisado_em) : null;

  // ---------------------------------------------------------------- voltou
  if (!ruim) {
    if (!desde) {
      // Já estava bem. Guarda o número atual mesmo assim: é o que permite ao
      // painel dizer "tudo certo, 7.203 ofertas na última hora" em vez de um
      // campo vazio que não distingue "está bem" de "nunca mediu".
      await pool.query("UPDATE alerta_estado SET detalhe = ? WHERE tipo = ?", [
        detalhe.slice(0, 400),
        tipo,
      ]);
      return;
    }
    // ⚠ Só manda o "voltou ao normal" se o "está fora" chegou a sair. Sem esta
    // conferência, um tropeço de 10 minutos renderia um e-mail dizendo que algo
    // que ele nunca soube que quebrou foi consertado.
    if (estado.avisos > 0) {
      const texto =
        `${titulo} voltou ao normal.\n\n` +
        `Ficou fora por ${faz(desde)}, desde ${dataHora(desde)}.\n` +
        `Situação agora: ${detalhe}\n\n` +
        `iCompras · aviso automático do guardião`;
      await enviar(
        `✅ ${titulo} voltou ao normal`,
        texto,
        `<p><strong>${titulo} voltou ao normal.</strong></p>
         <p>Ficou fora por <strong>${faz(desde)}</strong>, desde ${dataHora(desde)}.</p>
         <p>Situação agora: ${detalhe}</p>
         <p style="color:#64748b;font-size:12px">iCompras · aviso automático do guardião</p>`,
      );
    }
    await pool.query(
      "UPDATE alerta_estado SET ruim_desde = NULL, avisado_em = NULL, avisos = 0, detalhe = ? WHERE tipo = ?",
      [detalhe.slice(0, 400), tipo],
    );
    return;
  }

  // ------------------------------------------------------------ está ruim
  if (!desde) {
    // Primeira vez que se vê o problema: marca a hora e NÃO avisa ainda.
    await pool.query(
      "UPDATE alerta_estado SET ruim_desde = NOW(), detalhe = ? WHERE tipo = ?",
      [detalhe.slice(0, 400), tipo],
    );
    return;
  }

  const minutos = Math.floor((Date.now() - desde.getTime()) / 60000);
  if (minutos < ESPERA_MIN) {
    // Ainda dentro da tolerância: só atualiza o que está acontecendo.
    await pool.query("UPDATE alerta_estado SET detalhe = ? WHERE tipo = ?", [detalhe.slice(0, 400), tipo]);
    return;
  }

  // Passou da hora. Avisa se ainda não avisou, ou se já deu o tempo do lembrete.
  const horasDesdeAviso = avisadoEm ? (Date.now() - avisadoEm.getTime()) / 3600000 : Infinity;
  if (horasDesdeAviso < LEMBRETE_H) {
    await pool.query("UPDATE alerta_estado SET detalhe = ? WHERE tipo = ?", [detalhe.slice(0, 400), tipo]);
    return;
  }

  const repetido = (estado.avisos ?? 0) > 0;
  const assunto = repetido
    ? `⚠ ${titulo} — ainda fora, faz ${faz(desde)}`
    : `⚠ ${titulo} — fora do ar há mais de ${ESPERA_MIN} minutos`;

  const texto =
    `${titulo}\n\n` +
    `Começou em ${dataHora(desde)} — faz ${faz(desde)}.\n\n` +
    `O que está acontecendo:\n${detalhe}\n\n` +
    `O que costuma resolver:\n${oQueFazer}\n\n` +
    `Painel: https://icompras.com.py/pt-BR/admin/monitor\n\n` +
    `iCompras · aviso automático do guardião. Você recebe este e-mail porque ` +
    `algo está fora do ar há mais de ${ESPERA_MIN} minutos; enquanto durar, ` +
    `um lembrete a cada ${LEMBRETE_H} horas.`;

  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:560px">
       <h2 style="color:#b45309;margin:0 0 12px">⚠ ${titulo}</h2>
       <p>Começou em <strong>${dataHora(desde)}</strong> — faz <strong>${faz(desde)}</strong>.</p>
       <p style="background:#fef3c7;padding:12px;border-radius:8px;margin:16px 0">
         <strong>O que está acontecendo</strong><br>${detalhe}
       </p>
       <p style="background:#f1f5f9;padding:12px;border-radius:8px">
         <strong>O que costuma resolver</strong><br>${oQueFazer}
       </p>
       <p><a href="https://icompras.com.py/pt-BR/admin/monitor">Abrir o painel</a></p>
       <p style="color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;padding-top:12px">
         iCompras · aviso automático do guardião. Enquanto durar, um lembrete a cada ${LEMBRETE_H} horas.
       </p>
     </div>`;

  const enviado = await enviar(assunto, texto, html);
  // ⚠ Só marca como avisado se o e-mail SAIU. Se o Resend estiver fora, a
  // próxima verificação tenta de novo em vez de dar o problema por comunicado.
  if (enviado) {
    await pool.query(
      "UPDATE alerta_estado SET avisado_em = NOW(), avisos = avisos + 1, detalhe = ? WHERE tipo = ?",
      [detalhe.slice(0, 400), tipo],
    );
    console.log(`  ✉ alerta enviado: ${titulo} (${faz(desde)})`);
  } else {
    await pool.query("UPDATE alerta_estado SET detalhe = ? WHERE tipo = ?", [detalhe.slice(0, 400), tipo]);
  }
}

/**
 * As duas conferências que geram alerta, com os números medidos no banco.
 *
 * 💡 A COLETA É MEDIDA PELO RESULTADO, não por processo de pé. Os seis
 * coletores ficaram rodando os três dias inteiros do episódio de 19/08 — de pé,
 * ocupados, e sem trazer nada. "O processo está vivo" não quer dizer "está
 * funcionando".
 */
export async function conferirAlertas(): Promise<void> {
  if (!configurado()) return;

  // ---------------------------------------------------------------- coleta
  const [c]: any = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM offer WHERE last_seen_at > NOW() - INTERVAL 60 MINUTE) AS ofertas,
       (SELECT COUNT(*) FROM crawl_category WHERE last_finished_at > NOW() - INTERVAL 6 HOUR) AS unidades`,
  );
  const ofertas = Number(c?.ofertas ?? 0);
  const unidades = Number(c?.unidades ?? 0);
  // Nenhuma oferta revista em uma hora inteira é coleta parada. O número normal
  // fica na casa dos milhares por hora.
  const coletaRuim = ofertas === 0;
  await acompanhar(
    "coleta",
    coletaRuim,
    coletaRuim
      ? `Nenhuma oferta foi atualizada na última hora (o normal são milhares). Unidades concluídas nas últimas 6 horas: ${unidades}.`
      : `${ofertas} ofertas atualizadas na última hora.`,
    "A coleta parou",
    "Ver se os coletores estão de pé no painel (Admin › Monitor VPS) e se a fonte está bloqueando o acesso. " +
      "Se o servidor de saída também estiver fora, é quase certo que a causa é essa.",
  );

  // ----------------------------------------------------------------- proxy
  const [s]: any = await pool.query("SELECT modo, ip_atual, detalhe FROM coletor_saida LIMIT 1");
  const modo = s?.modo ?? "direto";
  const proxyRuim = modo !== "proxy";
  await acompanhar(
    "proxy",
    proxyRuim,
    proxyRuim
      ? `A coleta está saindo pelo IP do próprio servidor, não pelo servidor de saída. ${s?.detalhe ?? ""}`.trim()
      : `Saindo normalmente pelo servidor de saída (IP ${s?.ip_atual ?? "?"}).`,
    "O servidor de saída está fora",
    "Entrar no servidor de Dallas e conferir o túnel: `systemctl status wg-quick@wg0`. " +
      "Se estiver em falha, limpar as regras de roteamento sobrando (`ip rule del table 100`, repetido) " +
      "e subir de novo. Enquanto isso, a fonte tende a bloquear o IP da VPS.",
  );
}
