-- Marca de rodada nas quedas de preço, para a limpeza não depender de relógio.
--
-- ⚠ O DEFEITO QUE ISTO CONSERTA (05/08/2026, reproduzido linha a linha):
-- o recálculo gravava as quedas e depois apagava "o que sobrou da rodada
-- anterior" comparando `computed_at < inicio`, onde `inicio` era a hora em que
-- a função começou. Só que:
--
--   inicio (JavaScript, com milissegundos) = 17:54:40.847
--   computed_at (TIMESTAMP, só segundos)   = 17:54:40.000
--
-- ...e 17:54:40.000 É anterior a 17:54:40.847. Ou seja: toda linha gravada
-- DENTRO DO MESMO SEGUNDO em que a rodada começou era apagada logo em seguida,
-- por parecer velha. Como era uma corrida contra o relógio, o resultado variava
-- — a janela de 30 dias sobrevivia e a de 7 sumia, deixando a página "Baixaram
-- de preço" vazia sem erro nenhum aparecer em log.
--
-- Com um número de rodada, a pergunta deixa de ser "isto é antigo?" (que
-- depende de precisão de relógio) e passa a ser "isto é DESTA rodada?", que é
-- exata.
ALTER TABLE product_price_drop
  ADD COLUMN rodada BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER offers,
  ADD INDEX idx_queda_rodada (janela, rodada);
