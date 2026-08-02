-- 014_api_usage.sql — contador diário de requisições da API (limite por plano).

CREATE TABLE IF NOT EXISTS api_usage (
  store_id BIGINT UNSIGNED NOT NULL,
  day      DATE NOT NULL,
  count    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, day),
  CONSTRAINT fk_usage_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
