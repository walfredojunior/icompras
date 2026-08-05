-- Um sinal de vida POR ROBÔ, e o papel de cada um.
--
-- ⚠ O PONTO CEGO QUE ISTO CONSERTA: até aqui havia UMA linha de controle
-- (`scrape_control`, id=1) para os quatro robôs, e todos escreviam nela. Com
-- robôs iguais isso bastava — se um caía, os outros cobriam o trabalho dele.
--
-- Passando a especializar (um só para produtos quentes, outro só para produtos
-- novos), o arranjo vira perigoso: se o robô dos quentes travar e os outros
-- continuarem batendo na mesma linha, o guardião lê "sinal fresco" e conclui
-- que está tudo bem — enquanto os preços que MAIS importam envelhecem sem que
-- ninguém perceba. Falha silenciosa é pior que falha barulhenta.
--
-- `scrape_control` continua existindo e continua sendo o liga/desliga geral do
-- painel. Esta tabela é a SAÚDE de cada robô, não o comando.
CREATE TABLE IF NOT EXISTS crawl_robo (
  worker_id       TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  papel           VARCHAR(12)  NOT NULL DEFAULT 'normal', -- normal | quentes | novos
  pid             INT UNSIGNED NULL,
  message         VARCHAR(250) NULL,
  started_at      DATETIME     NULL,
  heartbeat_at    DATETIME     NULL,
  -- Produtividade, não só batimento: robô VIVO e PARADO é o caso que o
  -- guardião não enxergava. `ciclo_fechado_em` é quando ele terminou a última
  -- volta completa do trabalho dele (todas as categorias, ou toda a lista de
  -- quentes, ou toda a varredura de novos).
  ciclo_aberto_em DATETIME     NULL,
  ciclo_fechado_em DATETIME    NULL,
  itens_no_ciclo  INT UNSIGNED NOT NULL DEFAULT 0,
  ciclos          INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_robo_papel (papel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
