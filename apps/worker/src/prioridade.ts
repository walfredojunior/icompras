import { pool } from "@icompras/db";

// CLASSIFICA CADA PRODUTO POR QUANTO ELE MERECE SER RECONFERIDO.
//
// A pergunta que isto responde é "o que é produto quente?". A resposta sai de
// três sinais, do mais confiável para o menos:
//
//   1. JÁ MUDOU DE PREÇO. É evidência, não palpite. 1.911 produtos se mexeram
//      nos 9 dias medidos em 05/08/2026.
//   2. QUANTAS LOJAS VENDEM. É o melhor palpite para quem ainda não tem
//      histórico, e os dados provam: 1 loja muda 0,1% das vezes; 10 a 19 lojas
//      mudam 25,3% — 250 vezes mais. Todo produto tem esse número desde o
//      primeiro dia.
//   3. SE ALGUÉM OLHA. Preço velho num produto que ninguém abre não custa
//      nada; num que as pessoas olham, custa credibilidade. Hoje esse sinal
//      quase não trabalha (só 90 produtos foram abertos desde 30/07), mas é o
//      que mais vai pesar quando o site crescer.
//
// E o principal: NÃO PRECISO ACERTAR DE PRIMEIRA. A cada reconferência o robô
// descobre se acertou — produto "parado" que apareceu com preço novo sobe de
// faixa na próxima classificação. A conta se corrige sozinha com o uso.

/**
 * Tetos conservadores DE PROPÓSITO na estreia.
 *
 * O risco deste plano não é técnico, é PREÇO VELHO — e preço errado é o pior
 * defeito possível num comparador. Por isso o produto mais parado espera no
 * máximo 3 dias, e não a semana que a economia permitiria. Amplia-se depois,
 * com evidência, olhando o painel dos quentes.
 */
export const FAIXAS = {
  quente: 6, // mudou de preço na última semana
  morno: 12, // 10+ lojas, ou alguém abriu a página
  normal: 24, // 5 a 9 lojas — é o comportamento de hoje
  frio: 48, // 2 a 4 lojas
  gelado: 72, // 1 loja: 0,1% de chance de mudar
} as const;

export async function classificarProdutos(): Promise<Record<string, number>> {
  // Tudo numa tabela temporária primeiro: são ~223 mil linhas, e fazer isso
  // com subconsulta por linha levaria horas.
  await pool.query("DROP TEMPORARY TABLE IF EXISTS tmp_prio");
  await pool.query(`
    CREATE TEMPORARY TABLE tmp_prio (
      external_id VARCHAR(200) NOT NULL PRIMARY KEY,
      intervalo   SMALLINT UNSIGNED NOT NULL,
      faixa       VARCHAR(16) NOT NULL
    ) ENGINE=MEMORY
  `);

  // Um produto pode ter várias ofertas com o mesmo external_id da fonte; o
  // GROUP BY resolve. `lojas` sai da contagem de lojas distintas com oferta.
  await pool.query(
    `INSERT INTO tmp_prio (external_id, intervalo, faixa)
     SELECT x.ext,
            CASE WHEN x.mudou THEN ?
                 WHEN x.visto OR x.lojas >= 10 THEN ?
                 WHEN x.lojas >= 5 THEN ?
                 WHEN x.lojas >= 2 THEN ?
                 ELSE ? END,
            CASE WHEN x.mudou THEN 'quente'
                 WHEN x.visto OR x.lojas >= 10 THEN 'morno'
                 WHEN x.lojas >= 5 THEN 'normal'
                 WHEN x.lojas >= 2 THEN 'frio'
                 ELSE 'gelado' END
       FROM (
         SELECT o.external_id AS ext,
                COUNT(DISTINCT o.store_id) AS lojas,
                MAX(h.mudou IS NOT NULL) AS mudou,
                MAX(a.slug IS NOT NULL)  AS visto
           FROM offer o
           JOIN product_variant v ON v.id = o.variant_id
           JOIN product p ON p.id = v.product_id
           -- Mudou de preço na última semana?
           LEFT JOIN (
             SELECT product_id, 1 AS mudou
               FROM product_price_daily
              WHERE day >= CURDATE() - INTERVAL 7 DAY
              GROUP BY product_id
             HAVING COUNT(DISTINCT min_usd) > 1
           ) h ON h.product_id = p.id
           -- Alguém abriu a página deste produto?
           LEFT JOIN (
             SELECT DISTINCT slug FROM analytics_page
              WHERE kind = 'produto' AND day > CURDATE() - INTERVAL 30 DAY
           ) a ON a.slug = p.slug
          WHERE o.source = 'scraped' AND o.external_id IS NOT NULL
          GROUP BY o.external_id
       ) x`,
    [FAIXAS.quente, FAIXAS.morno, FAIXAS.normal, FAIXAS.frio, FAIXAS.gelado],
  );

  await pool.query(
    `UPDATE scrape_log s JOIN tmp_prio t ON t.external_id = s.external_id
        SET s.intervalo_horas = t.intervalo,
            s.faixa = t.faixa,
            s.classificado_em = NOW()`,
  );

  const linhas = await pool.query(
    "SELECT faixa, COUNT(*) n FROM scrape_log WHERE faixa IS NOT NULL GROUP BY faixa",
  );
  await pool.query("DROP TEMPORARY TABLE IF EXISTS tmp_prio");

  const saida: Record<string, number> = {};
  for (const r of linhas) saida[String(r.faixa)] = Number(r.n);
  return saida;
}

const executadoDireto =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (executadoDireto) {
  classificarProdutos()
    .then((r) => {
      const total = Object.values(r).reduce((a, b) => a + b, 0);
      console.log(`Classificados ${total} produto(s):`);
      for (const [faixa, n] of Object.entries(r).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${faixa.padEnd(8)} ${String(n).padStart(7)}  (a cada ${FAIXAS[faixa as keyof typeof FAIXAS]}h)`);
      }
      return pool.end();
    })
    .catch((e) => {
      console.error("Falha ao classificar:", e);
      process.exit(1);
    });
}
