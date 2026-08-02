-- 007_scrape_log.sql — controle do crawler (retomável + monitoramento).

CREATE TABLE IF NOT EXISTS scrape_log (
  external_id     VARCHAR(200) NOT NULL PRIMARY KEY,
  last_crawled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
