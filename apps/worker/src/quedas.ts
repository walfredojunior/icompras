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

/** As mesmas janelas que a página oferece nas abas. */
const JANELAS = [1, 7, 30] as const;

export async function atualizarQuedas(): Promise<number> {
  const inicio = new Date();
  for (const dias of JANELAS) {
    // INSERT ... ON DUPLICATE primeiro e só depois apagar o que sobrou:
    // assim a página nunca encontra a tabela vazia no meio da atualização.
    await pool.query(
      `INSERT INTO product_price_drop (janela, product_id, antes, agora, pct, offers)
       SELECT ?, j.product_id, j.antes, j.min_usd,
              ROUND((j.antes - j.min_usd) / j.antes * 100), j.offers
         FROM (SELECT product_id, day, min_usd, offers,
                      FIRST_VALUE(min_usd) OVER (PARTITION BY product_id ORDER BY day) AS antes
                 FROM product_price_daily
                WHERE day >= CURDATE() - INTERVAL ? DAY) j
        WHERE j.day = CURDATE()
          AND j.antes > j.min_usd
          AND (j.antes - j.min_usd) / j.antes >= ?
       ON DUPLICATE KEY UPDATE
          antes = VALUES(antes), agora = VALUES(agora),
          pct = VALUES(pct), offers = VALUES(offers)`,
      [dias, dias, QUEDA_MINIMA],
    );
    // Produto que subiu de preço (ou saiu do ar) some da lista.
    await pool.query("DELETE FROM product_price_drop WHERE janela = ? AND computed_at < ?", [dias, inicio]);
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
