import { createHash, randomBytes } from "node:crypto";

// QUANTAS PESSOAS ESTÃO NO SITE AGORA.
//
// Pedido dele em 17/08/2026: *"queria também que mostrasse quantos usuários
// online, ali no visitas, de forma discreta"*.
//
// ====================================================================
// POR QUE ISTO NÃO SAI DAS TABELAS QUE JÁ EXISTEM
// ====================================================================
// Toda a medição de audiência é agregada por DIA (`analytics_daily`,
// `analytics_page`): não existe "visita às 15h47". Foi decisão deliberada —
// o arquivo `analytics.ts` diz, em voz alta, "nada de IP nem de identificador
// pessoal". Então "quem está agora" precisou de mecanismo novo.
//
// ====================================================================
// COMO ISTO RESPEITA AQUELA DECISÃO
// ====================================================================
// Para contar PESSOAS (e não páginas abertas) é preciso distinguir uma da
// outra. O que se guarda aqui é um resumo embaralhado de IP + navegador que:
//
//   • nunca vai ao banco nem ao disco — vive só na memória do processo;
//   • **não pode ser revertido** para o IP, porque o tempero (`TEMPERO`) é
//     sorteado quando o site sobe e não é guardado em lugar nenhum;
//   • some sozinho em 5 minutos.
//
// Ou seja: dá para contar quantos são, e não dá para saber quem são — nem
// depois, nem com o banco em mãos. Publicar o site troca o tempero, o que
// torna qualquer comparação entre execuções impossível de propósito.
//
// ====================================================================
// ⚠ POR QUE UM Map NA MEMÓRIA, E NÃO BANCO OU REDIS
// ====================================================================
// Em 17/08/2026 o site passou o dia lento porque uma consulta lia 113 MB/s de
// disco. No mesmo dia o dono pediu, duas vezes, cuidado para não sobrecarregar
// o servidor. Um contador de audiência **não pode** ser mais uma escrita no
// banco a cada página aberta. Aqui não há escrita, não há disco, não há
// dependência nova: é uma listinha na memória, com custo de microssegundos.
//
// ⚠ ISTO SÓ FUNCIONA PORQUE O SITE RODA NUM PROCESSO SÓ (`pm2`, modo `fork`,
// uma instância — conferido em 17/08/2026). **Se um dia o site passar a rodar
// em várias cópias, cada uma contará só a sua parte e o número sairá menor.**
// Nesse dia, a conta muda de lugar (Redis, que já está no ar para as filas) —
// e é por isso que esta observação está escrita aqui, e não na cabeça de
// ninguém.
//
// ⚠ O número ZERA quando o site é publicado, porque a memória do processo se
// perde. Enche de novo em segundos. É esperado, não defeito.

/** Quanto tempo sem carregar página até a pessoa deixar de contar. */
const JANELA_MS = 5 * 60 * 1000;

/**
 * Teto de segurança. Um pico anormal (ou um robô que escape do filtro) não
 * pode fazer esta lista crescer sem fim dentro do processo do site.
 */
const TETO = 20_000;

/**
 * Sorteado a cada vez que o site sobe, e nunca guardado. É o que impede que o
 * resumo embaralhado seja revertido em IP, mesmo por quem tem o servidor.
 */
const TEMPERO = randomBytes(32);

const vistos = new Map<string, number>();

/** Resumo curto e irreversível de quem está pedindo a página. */
export function chaveDePresenca(ip: string, navegador: string): string {
  return createHash("sha256")
    .update(TEMPERO)
    .update(ip)
    .update("|")
    .update(navegador)
    .digest("hex")
    .slice(0, 24);
}

/** Anota que esta pessoa está viva agora. Custo: uma escrita num Map. */
export function marcarPresenca(chave: string): void {
  const agora = Date.now();
  // A limpeza acontece na LEITURA (barata e rara, só o admin lê). Aqui só se
  // faz uma varredura se a lista passar do teto — situação que não deve
  // acontecer, e que é melhor tratar do que ignorar.
  if (vistos.size >= TETO) limpar(agora);
  vistos.set(chave, agora);
}

function limpar(agora: number): void {
  const corte = agora - JANELA_MS;
  for (const [chave, quando] of vistos) {
    if (quando < corte) vistos.delete(chave);
  }
}

/** Quantas pessoas carregaram alguma página nos últimos 5 minutos. */
export function quantosAgora(): number {
  const agora = Date.now();
  limpar(agora);
  return vistos.size;
}

/** Só para a tela explicar o número sem o leitor precisar adivinhar. */
export const JANELA_MINUTOS = JANELA_MS / 60000;
