// DATAS COMEMORATIVAS no campo de busca.
//
// Ideia dele em 15/08/2026: *"colocar algum detalhe no campo busca para datas
// comemorativas... minimalista e divertido"*.
//
// ⚠ SÓ DATAS DO BRASIL — decisão dele: *"o público é mais brasileiro porque o
// mercado é pra vender pra eles"*. Medido nos 14 dias anteriores: **66,9% das
// visitas são do Brasil** contra 20,3% do Paraguai. A primeira versão que
// propus mudava a data conforme o país do visitante (Dia das Crianças é 16/ago
// no Paraguai e 12/out no Brasil), e ele cortou com razão: complica o código e
// confunde dois terços do público para agradar um quinto.
//
// 💡 AS DUAS ESCOLHIDAS ALÉM DAS ÓBVIAS vieram dos dados dele: a busca número
// um do site é **"perfumes"** (82 vezes em 7 dias, à frente de "iphone"), e
// perfume é o presente clássico de Dia das Mães e Dia dos Namorados.

export interface DataComemorativa {
  chave: string;
  /** Emoji que aparece no começo do texto do campo. */
  emoji: string;
  /** Quantos dias ANTES o tema começa a aparecer. */
  antes: number;
}

/** As datas, em ordem de peso comercial no varejo brasileiro. */
const DATAS: Array<DataComemorativa & { quando: (ano: number) => Date }> = [
  {
    chave: "blackFriday",
    emoji: "🏷️",
    antes: 5, // a semana toda vira "black week" no comércio
    // ⚠ MÓVEL: última sexta-feira de novembro. Calculado, não escrito à mão —
    // senão daqui a um ano alguém precisa lembrar de corrigir, e ninguém lembra.
    quando: (ano) => {
      const d = new Date(Date.UTC(ano, 10, 30)); // 30 de novembro
      while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1);
      return d;
    },
  },
  {
    chave: "natal",
    emoji: "🎄",
    antes: 12, // dezembro inteiro é compra de Natal
    quando: (ano) => new Date(Date.UTC(ano, 11, 25)),
  },
  {
    chave: "diaDasMaes",
    emoji: "💐",
    antes: 5,
    // ⚠ MÓVEL: segundo domingo de maio.
    quando: (ano) => {
      const d = new Date(Date.UTC(ano, 4, 1));
      while (d.getUTCDay() !== 0) d.setUTCDate(d.getUTCDate() + 1); // 1º domingo
      d.setUTCDate(d.getUTCDate() + 7); // 2º domingo
      return d;
    },
  },
  {
    chave: "diaDosNamorados",
    emoji: "💝",
    antes: 4,
    quando: (ano) => new Date(Date.UTC(ano, 5, 12)),
  },
  {
    chave: "diaDasCriancas",
    emoji: "🎈",
    antes: 4,
    quando: (ano) => new Date(Date.UTC(ano, 9, 12)),
  },
];

/**
 * A data comemorativa de hoje, ou null se não houver.
 *
 * ⚠ CALCULADO NO FUSO DO BRASIL (UTC−3), não no do servidor. A VPS roda em UTC:
 * das 21h às 23h59 do horário de Brasília, lá já é o dia seguinte. Sem esta
 * correção, o tema de Natal apareceria (e sumiria) três horas antes da hora,
 * bem no horário de PICO do site — que é entre 20h e 23h.
 */
export function dataComemorativaDeHoje(agora: Date = new Date()): DataComemorativa | null {
  const brasilia = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  const hoje = Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), brasilia.getUTCDate());
  const ano = brasilia.getUTCFullYear();

  for (const d of DATAS) {
    // Olha este ano e o próximo: em 28 de dezembro, o Natal que importa já é o
    // do ano que vem — sem isso o tema sumiria e nunca mais voltaria a tempo.
    for (const a of [ano, ano + 1]) {
      const dia = d.quando(a).getTime();
      const comeca = dia - d.antes * 86_400_000;
      // Vale até o FIM do próprio dia: quem compra no dia 25 ainda está no Natal.
      if (hoje >= comeca && hoje <= dia) {
        return { chave: d.chave, emoji: d.emoji, antes: d.antes };
      }
    }
  }
  return null;
}
