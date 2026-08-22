// Datas dos formulários do admin — o dia de hoje e o fim de um período.
//
// ⚠ POR QUE ISTO EXISTE (22/08/2026). Ele pediu: "sobre data sempre mostre a
// data atual e daí a pessoa altera se quiser, faça igual em todos os cadastros
// que têm data".
//
// ⚠⚠ A ARMADILHA: O SERVIDOR RODA EM UTC E ELE ESTÁ NO PARAGUAI (-3).
//
// Estes formulários são componentes de cliente, mas o Next também os monta no
// SERVIDOR na primeira carga. Se a data for calculada durante a montagem, às
// 21h do Paraguai o servidor (já no dia seguinte, em UTC) escreve uma data e o
// navegador escreve outra — o React reclama da diferença e, pior, o campo
// aparece com o dia errado justamente no horário de pico.
//
// 💡 POR ISSO `hoje()` NUNCA DEVE SER CHAMADA DURANTE A MONTAGEM. Use dentro de
// `useEffect`, que só roda no navegador, onde o fuso é o dele.

/** Hoje, no fuso de quem está olhando, no formato aaaa-mm-dd. */
export function hoje(): string {
  const d = new Date();
  // Nada de `toISOString()`: ele converte para UTC e devolve o dia seguinte
  // depois das 21h no Paraguai. Estas três linhas leem o calendário local.
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * O fim de um período que começa em `inicio`.
 *
 * 💡 Mais útil que preencher o término com "hoje", que criaria um anúncio
 * vencendo no mesmo dia. Escolhida a duração, a data de término se preenche
 * sozinha — e continua editável.
 *
 * ⚠ Termina no DIA ANTERIOR ao mesmo dia do mês seguinte: um mês comprado em
 * 10/09 vai até 09/10, e não até 10/10. Senão o cliente ganha um dia de graça a
 * cada renovação, e duas vendas seguidas se sobrepõem — o que a trava de
 * exclusividade recusaria.
 */
export function fimDoPeriodo(inicio: string, duracao: string): string {
  if (!inicio) return "";
  const meses = duracao === "trimestral" ? 3 : duracao === "semestral" ? 6 : duracao === "mensal" ? 1 : 0;
  if (!meses) return "";

  const [a, m, d] = inicio.split("-").map(Number);
  // O mesmo dia, N meses depois (mês é 0-based no JavaScript).
  const alvo = new Date(a, m - 1 + meses, d);

  if (alvo.getDate() !== d) {
    // ⚠ TRANSBORDOU: 31/01 + 1 mês vira 03/03, porque fevereiro não tem dia 31.
    // `setDate(0)` volta para o último dia do mês certo — 28/02.
    alvo.setDate(0);
  } else {
    // A véspera do mesmo dia: um mês comprado em 10/09 vai até 09/10, não 10/10.
    // Sem isso o cliente ganha um dia a cada renovação e duas vendas seguidas se
    // sobrepõem — o que a trava de exclusividade recusaria.
    //
    // ⚠ `setDate(dia - 1)` e NÃO subtrair do número do dia: no dia 1 isso daria
    // zero, que o JavaScript lê como o último dia do mês ANTERIOR. Foi o que
    // aconteceu no teste: 01/01 + 1 mês devolveu 31/12 do ano passado.
    alvo.setDate(alvo.getDate() - 1);
  }

  const ano = alvo.getFullYear();
  const mes = String(alvo.getMonth() + 1).padStart(2, "0");
  const dia = String(alvo.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** As formas de pagamento que ele aceita. */
export const FORMAS_DE_PAGAMENTO = [
  { id: "efetivo", rotulo: "Efetivo (dinheiro)" },
  { id: "transferencia", rotulo: "Transferência" },
  { id: "cartao", rotulo: "Cartão (Bancard)" },
  { id: "outros", rotulo: "Outros" },
] as const;
