-- Cada produto passa a ter o SEU intervalo de reconferência.
--
-- Até aqui o coletor usava um número fixo para todo mundo (CRAWL_RECRAWL_HOURS,
-- 24h): o iPhone de 45 lojas e o anzol de US$ 2 eram reconferidos com a mesma
-- frequência. Medido em 05/08/2026, isso é quase todo desperdício:
--
--   1 loja   → 159.349 produtos → apenas 0,1% mudaram de preço em 9 dias
--   2 a 4    →  12.274 produtos → 6,2%
--   5 a 9    →   4.486 produtos → 13,6%
--   10 a 19  →   1.356 produtos → 25,3%
--   20+      →     270 produtos → 20,0%
--
-- Ou seja: 90% do catálogo é comprovadamente parado, e reconferi-lo todo dia
-- consome a volta inteira sem melhorar preço nenhum.
--
-- NULL = ainda não classificado; vale o padrão de 24h. É de propósito: produto
-- novo nunca é pulado por engano, e a mudança pode ser publicada antes da
-- classificação rodar, sem alterar comportamento nenhum.
ALTER TABLE scrape_log
  ADD COLUMN intervalo_horas SMALLINT UNSIGNED NULL AFTER last_crawled_at,
  -- Por que guardar a razão: quando um preço aparecer velho, a primeira
  -- pergunta vai ser "por que este produto estava em 72h?". Sem isto, não há
  -- como responder.
  ADD COLUMN faixa VARCHAR(16) NULL AFTER intervalo_horas,
  ADD COLUMN classificado_em TIMESTAMP NULL AFTER faixa;

-- O robô dos quentes procura por faixa; a volta normal procura por vencimento.
ALTER TABLE scrape_log
  ADD INDEX idx_slog_prioridade (intervalo_horas, last_crawled_at);
