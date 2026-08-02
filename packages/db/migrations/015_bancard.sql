-- 015_bancard.sql — operações de pagamento Bancard (rastreio do checkout + confirmação).

CREATE TABLE IF NOT EXISTS bancard_op (
  shop_process_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id         BIGINT UNSIGNED NOT NULL,
  billing_interval ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  amount           DECIMAL(14,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'USD',
  process_id       VARCHAR(120) NULL,
  status           ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bancard_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
  INDEX idx_bancard_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
