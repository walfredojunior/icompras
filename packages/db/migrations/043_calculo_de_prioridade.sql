-- Mesa de apoio para a classificação de prioridade.
--
-- A classificação era UM `UPDATE scrape_log JOIN (subconsulta grande)`. Em
-- 07/08/2026 ela ficou **3h52 rodando com 1.091.353 linhas travadas** e parou a
-- coleta: os robôs gravam em `scrape_log` a cada produto visitado, e o UPDATE
-- precisava travar as 253 mil linhas de uma vez. Disputa de ESCRITA contra
-- ESCRITA — mudar isolamento não resolve, porque ninguém está lendo demais.
--
-- Com a mesa de apoio vira duas etapas, e nenhuma delas segura a tabela que os
-- robôs usam:
--   1. calcular (lê `offer`, escreve AQUI — os robôs nem tocam nesta tabela);
--   2. gravar em `scrape_log` EM PEDAÇOS, cada um numa transação curta.
--
-- ⚠ Tabela de verdade, e não TEMPORARY: tabela temporária vive dentro de UMA
-- conexão, e o pool entrega uma conexão diferente a cada consulta. Já quebrou
-- assim em produção antes ("Table 'tmp_prio' doesn't exist", 05/08/2026).
--
-- O `id` sequencial existe só para dividir a gravação em pedaços parelhos.
CREATE TABLE IF NOT EXISTS prioridade_calc (
  id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ext    VARCHAR(200) NOT NULL,
  lojas  INT UNSIGNED NOT NULL DEFAULT 0,
  mudou  TINYINT(1)   NOT NULL DEFAULT 0,
  visto  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prio_ext (ext)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
