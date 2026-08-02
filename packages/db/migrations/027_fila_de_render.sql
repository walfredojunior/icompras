-- Fila dos produtos que exigem navegador.
--
-- A fonte tem dois tipos de página de produto:
--   • a comum, lida por leitura direta em ~0,25s
--   • o anúncio de loja única (endereço com "__"), em que o preço é escrito
--     por JavaScript e SÓ pode ser lido abrindo o navegador (~2s)
--
-- Até 01/08/2026 os dois eram tratados na mesma fila, e isso fazia um produto
-- lento no meio do caminho segurar os 30 rápidos que vinham atrás. A volta
-- completa pulou de 2,3h para 5,9h e a carga da máquina de 0,24 para 2,8.
--
-- Agora, ao esbarrar num desses durante a volta normal, o coletor NÃO para:
-- anota aqui e segue. No fim da volta ele processa esta fila com um teto, no
-- ritmo que der, sem atrapalhar a coleta principal.
CREATE TABLE IF NOT EXISTS render_queue (
  path        VARCHAR(300) NOT NULL PRIMARY KEY,   -- /produto-slug__1234567/
  external_id VARCHAR(200) NOT NULL,
  added_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_try_at DATETIME     NULL,
  tries       INT UNSIGNED NOT NULL DEFAULT 0,
  INDEX idx_rq_ordem (last_try_at, added_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
