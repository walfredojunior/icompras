-- Progresso do crawler por categoria.
-- Antes o crawler percorria a lista sempre a partir da primeira categoria; se
-- o processo caísse no meio (o navegador estourava a memória), ele reiniciava
-- do começo e as categorias do fim da lista nunca eram visitadas.
-- Com esta tabela a ordem de cada volta passa a ser: nunca visitadas primeiro,
-- depois as visitadas há mais tempo.
CREATE TABLE IF NOT EXISTS crawl_category (
  path             VARCHAR(160) NOT NULL PRIMARY KEY,
  our_category     VARCHAR(60)  NULL,
  last_started_at  DATETIME     NULL,
  last_finished_at DATETIME     NULL,
  last_products    INT          NOT NULL DEFAULT 0,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_crawl_category_ordem (last_finished_at, last_started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
