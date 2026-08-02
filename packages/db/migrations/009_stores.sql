-- 009_stores.sql — detalhes da loja, menor preço no produto e ligação produto<->loja.

ALTER TABLE store
  ADD COLUMN address     VARCHAR(300) NULL,
  ADD COLUMN city        VARCHAR(120) NULL,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN maps_query  VARCHAR(300) NULL;

ALTER TABLE product ADD COLUMN min_price_usd DECIMAL(14,2) NULL;

-- Quais lojas vendem cada produto (do agregador; sem preço por loja).
CREATE TABLE IF NOT EXISTS product_store (
  product_id BIGINT UNSIGNED NOT NULL,
  store_id   BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, store_id),
  CONSTRAINT fk_ps_prod FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
