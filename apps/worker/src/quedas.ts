import { pool } from "@icompras/db";

// CÁLCULO DAS QUEDAS DE PREÇO — feito UMA vez, não a cada visita.
//
// Medido em 05/08/2026: esta conta percorre uma semana de `product_price_daily`
// (607 mil linhas) com função de janela e leva ~1,6 segundo. Ela estava sendo
// refeita a cada abertura da página /quedas, da home e de qualquer listagem com
// o selo "−18%" — para responder algo que só muda quando o preço muda, ou seja,
// uma vez por dia.
//
// Fica em arquivo próprio (e não dentro do crawl.ts) para poder ser executado
// sozinho: `npm run quedas -w @icompras/worker`. Serve para o primeiro
// preenchimento logo depois de publicar, sem esperar o coletor fechar uma volta.

/** Abaixo disso não é queda, é ruído de centavo. */
const QUEDA_MINIMA = 0.03;

/**
 * ACIMA disso não é promoção, é erro de dado — e a página não mostra.
 *
 * Rede de segurança de última instância (05/08/2026). Três vezes num dia a
 * página "Baixaram de preço" foi flagrada anunciando bobagem: o Garmin de
 * US$ 650 "caindo" para US$ 8 (era um fone na mesma página), o patinete de
 * US$ 430 para US$ 76 (era o assento) e a moto elétrica de US$ 860 para
 * US$ 15 (era um perfume Victoria Secret colado nela). Cada caso teve uma
 * causa diferente e foi corrigido na origem — mas todos tinham em comum uma
 * queda irreal.
 *
 * Desconto real acima de 90% não existe neste catálogo. Então, mesmo que
 * apareça um defeito novo que eu não previ, ele não chega à vitrine.
 */
const QUEDA_MAXIMA = 0.9;

/** As mesmas janelas que a página oferece nas abas. */
const JANELAS = [1, 7, 30] as const;

export async function atualizarQuedas(): Promise<number> {
  // NÚMERO DA RODADA, não relógio.
  //
  // ⚠ A versão anterior comparava `computed_at < inicio` para apagar o que
  // sobrou da rodada passada, e isso APAGAVA O QUE ACABARA DE SER GRAVADO:
  // `inicio` tinha milissegundos (17:54:40.847) e a coluna só guarda segundos
  // (17:54:40.000), então tudo que entrasse no mesmo segundo parecia velho.
  // Era uma corrida — a janela de 30 dias sobrevivia, a de 7 sumia, e a página
  // ficava vazia sem erro nenhum no log. Ver migration 035.
  const rodada = Date.now();
  for (const dias of JANELAS) {
    // INSERT ... ON DUPLICATE primeiro e só depois apagar o que sobrou:
    // assim a página nunca encontra a tabela vazia no meio da atualização.
    await pool.query(
      `INSERT INTO product_price_drop (janela, product_id, antes, agora, pct, offers, rodada)
       SELECT ?, j.product_id, j.antes, j.min_usd,
              ROUND((j.antes - j.min_usd) / j.antes * 100), j.offers, ?
         FROM (SELECT product_id, day, min_usd, offers,
                      FIRST_VALUE(min_usd) OVER (PARTITION BY product_id ORDER BY day) AS antes
                 FROM product_price_daily
                WHERE day >= CURDATE() - INTERVAL ? DAY) j
        WHERE j.day = CURDATE()
          AND j.antes > j.min_usd
          AND (j.antes - j.min_usd) / j.antes >= ?
          AND (j.antes - j.min_usd) / j.antes <= ?
       ON DUPLICATE KEY UPDATE
          antes = VALUES(antes), agora = VALUES(agora),
          pct = VALUES(pct), offers = VALUES(offers), rodada = VALUES(rodada),
          -- ⚠ ESTA LINHA É OBRIGATÓRIA, e a falta dela zerou a página em
          -- produção no primeiro deploy (05/08/2026). O MariaDB NÃO regrava a
          -- linha quando os valores novos são idênticos aos antigos — e, sem
          -- regravar, o \`ON UPDATE CURRENT_TIMESTAMP\` não dispara. Resultado:
          -- todo produto cuja queda continuou EXATAMENTE igual ficava com a
          -- data velha e era apagado pela limpeza logo abaixo, como se não
          -- fosse mais uma queda. Atribuindo a data explicitamente, a linha
          -- sempre muda e sempre sobrevive.
          computed_at = CURRENT_TIMESTAMP`,
      [dias, rodada, dias, QUEDA_MINIMA, QUEDA_MAXIMA],
    );
    // Produto que subiu de preço (ou saiu do ar) some da lista. A pergunta é
    // "é desta rodada?", que é exata — e não "é antigo?", que dependia de
    // precisão de relógio e apagava o que acabara de entrar.
    await pool.query("DELETE FROM product_price_drop WHERE janela = ? AND rodada <> ?", [dias, rodada]);
  }
  const [n] = await pool.query("SELECT COUNT(*) c FROM product_price_drop WHERE janela = 7");
  return Number(n?.c ?? 0);
}

// Permite rodar sozinho: `tsx src/quedas.ts`.
const executadoDireto =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (executadoDireto) {
  atualizarQuedas()
    .then((n) => {
      console.log(`Quedas recalculadas: ${n} produto(s) na janela de 7 dias.`);
      return pool.end();
    })
    .catch((e) => {
      console.error("Falha ao recalcular quedas:", e);
      process.exit(1);
    });
}
