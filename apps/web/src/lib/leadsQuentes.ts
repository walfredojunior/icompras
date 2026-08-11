import { pool } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */

// CLIENTES POTENCIAIS QUENTES — lojas que saíram, ou estão saindo, do concorrente.
//
// Ideia do dono (11/08/2026): "uma lista de clientes que tinha a loja no
// compras paraguai e daí sumiu — ou seja, ele deixou de anunciar, então eu
// posso oferecer o iCompras pra ele com um preço mais barato".
//
// O ponto forte é o MOMENTO: quem acabou de parar de pagar o concorrente é
// exatamente quem está aberto a ouvir uma alternativa. E o coletor já guardou
// o WhatsApp da loja, então dá para abordar sabendo do que falar.
//
// ⚠ POR QUE ESTE SINAL É CONFIÁVEL, SENDO QUE O DE OFERTA NÃO É. Em 08-10/08
// eu tentei duas vezes marcar "oferta sumiu" e errei 12% das duas vezes: a
// fonte lista as lojas por MODELO, e a nossa leitura pega um modelo só. Aqui o
// sinal é a LOJA INTEIRA parar junto — dezenas de ofertas de uma vez. O ruído
// que estraga o caso individual se cancela na soma.
//
// ⚠ NÃO CALCULA NADA GUARDADO. Tudo sai do carimbo `last_seen_at`, que o
// coletor atualiza a cada leitura. Não há tarefa agendada, nem tabela para
// encher, nem nada a mais para o guardião vigiar: a lista está sempre atual no
// instante em que a tela abre.

/** Dias sem aparecer para a loja contar como "saiu". */
const DIAS_SUMIDA = 14;

// Por que 14 e não 7: a nossa própria volta às vezes passa de uma semana (ver
// a seção do coletor na memória). Com 7 dias, loja que só demorou a ser
// revisitada entraria na lista — e reaparecer depois de você ter oferecido
// desconto é constrangimento à toa.

/** Só considera loja com pelo menos isto de catálogo. Uma loja de 2 ofertas some por qualquer motivo. */
const MINIMO_PARA_CONTAR = 5;

/** Quanto do catálogo precisa ter sumido para contar como "encolheu". */
const FRACAO_QUE_SOBROU = 0.3;

export interface LojaLead {
  slug: string;
  nome: string;
  cidade: string | null;
  whatsapp: string | null;
  site: string | null;
  ofertas: number;
  /** Só em "encolheu": quantas ainda estão sendo anunciadas. */
  aindaTem?: number;
  dias: number;
  menorUsd: number | null;
  maiorUsd: number | null;
}

function linhaParaLead(r: any): LojaLead {
  return {
    slug: String(r.slug),
    nome: String(r.name),
    cidade: r.city ?? null,
    whatsapp: r.phone ?? null,
    site: r.site ?? null,
    ofertas: Number(r.ofertas ?? 0),
    aindaTem: r.agora == null ? undefined : Number(r.agora),
    dias: Number(r.dias ?? 0),
    menorUsd: r.menor == null ? null : Number(r.menor),
    maiorUsd: r.maior == null ? null : Number(r.maior),
  };
}

/**
 * Lojas que pararam de anunciar por completo.
 *
 * `minDias`/`maxDias` permitem separar as CONFIRMADAS (14 dias ou mais) das
 * que estão só EM OBSERVAÇÃO (7 a 14). A separação existe porque 14 dias é um
 * prazo escolhido por segurança, e não uma verdade: uma loja parada há 12 dias
 * provavelmente saiu mesmo, mas eu não quero apresentá-la com a mesma
 * confiança — quem liga oferecendo desconto para quem não saiu passa vergonha.
 */
export async function lojasQueSairam(minDias = DIAS_SUMIDA, maxDias = 100000): Promise<LojaLead[]> {
  const linhas = await pool
    .query(
      `SELECT s.slug, s.name, s.city, s.phone, s.external_url AS site,
              COUNT(*) AS ofertas,
              DATEDIFF(NOW(), MAX(o.last_seen_at)) AS dias,
              MIN(o.price_usd) AS menor, MAX(o.price_usd) AS maior
         FROM offer o JOIN store s ON s.id = o.store_id
        WHERE o.source = 'scraped'
        GROUP BY s.id
       HAVING COUNT(*) >= ?
          AND DATEDIFF(NOW(), MAX(o.last_seen_at)) >= ?
          AND DATEDIFF(NOW(), MAX(o.last_seen_at)) < ?
        ORDER BY ofertas DESC
        LIMIT 60`,
      [MINIMO_PARA_CONTAR, minDias, maxDias],
    )
    .catch(() => []);
  return linhas.map(linhaParaLead);
}

/** As que ainda não completaram o prazo — mostradas com esse rótulo. */
export const DIAS_OBSERVACAO = 7;
export async function lojasEmObservacao(): Promise<LojaLead[]> {
  return lojasQueSairam(DIAS_OBSERVACAO, DIAS_SUMIDA);
}

/**
 * Lojas que continuam anunciando, mas cortaram a maior parte do catálogo.
 *
 * 💡 Costumam ser um lead MELHOR que as que sumiram: estão cortando gasto com
 * o concorrente e continuam **ativas e atendendo o telefone**. Quem sumiu por
 * completo pode ter fechado as portas — e aí não é cliente de ninguém.
 */
export async function lojasQueEncolheram(): Promise<LojaLead[]> {
  const linhas = await pool
    .query(
      `SELECT s.slug, s.name, s.city, s.phone, s.external_url AS site,
              COUNT(*) AS ofertas,
              SUM(o.last_seen_at > NOW() - INTERVAL 7 DAY) AS agora,
              DATEDIFF(NOW(), MAX(o.last_seen_at)) AS dias,
              MIN(o.price_usd) AS menor, MAX(o.price_usd) AS maior
         FROM offer o JOIN store s ON s.id = o.store_id
        WHERE o.source = 'scraped'
        GROUP BY s.id
       -- ⚠ Repetindo COUNT/SUM em vez de usar os apelidos: o MariaDB recusa
       -- "Reference 'tinha' not supported (reference to group function)"
       -- quando um apelido de agregação entra noutra expressão de agregação.
       -- Descoberto rodando a consulta no banco de verdade ANTES de publicar.
       HAVING COUNT(*) >= 20
          AND SUM(o.last_seen_at > NOW() - INTERVAL 7 DAY) > 0
          AND SUM(o.last_seen_at > NOW() - INTERVAL 7 DAY) <= COUNT(*) * ?
        ORDER BY (COUNT(*) - SUM(o.last_seen_at > NOW() - INTERVAL 7 DAY)) DESC
        LIMIT 60`,
      [FRACAO_QUE_SOBROU],
    )
    .catch(() => []);
  return linhas.map(linhaParaLead);
}

/**
 * A leitura está confiável, ou a lista é fruto de defeito nosso?
 *
 * ⚠ Esta é a mesma trava do teto das baixas de oferta, pelo mesmo motivo. Se
 * muitas lojas aparecerem sumidas ao mesmo tempo, a explicação provável não é
 * um êxodo do concorrente — é a nossa leitura ter quebrado, ou o coletor ter
 * ficado dias parado. Mandar o dono ligar para trinta lojas que nunca saíram
 * queima o trabalho dele e a credibilidade da tela.
 */
export async function leituraConfiavel(quantasSairam: number): Promise<{ ok: boolean; motivo: string | null }> {
  const [r] = await pool
    .query(
      `SELECT (SELECT COUNT(*) FROM store) AS lojas,
              TIMESTAMPDIFF(HOUR, (SELECT MAX(last_seen_at) FROM offer WHERE source = 'scraped'), NOW()) AS horasSemColeta`,
    )
    .catch(() => [null]);

  const lojas = Number(r?.lojas ?? 0);
  const horas = Number(r?.horasSemColeta ?? 0);

  if (horas > 24) {
    return { ok: false, motivo: `o coletor não registra leitura há ${horas} h — a lista abaixo não é confiável` };
  }
  if (lojas > 0 && quantasSairam > lojas * 0.2) {
    return {
      ok: false,
      motivo: `${quantasSairam} de ${lojas} lojas apareceram como sumidas de uma vez — isso quase certamente é falha da nossa leitura, não êxodo do concorrente`,
    };
  }
  return { ok: true, motivo: null };
}
