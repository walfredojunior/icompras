-- 012_billing.sql — cobrança: planos em USD, anual (−10%), trial, carência e histórico de pagamentos.

-- Planos: preço anual, dias de trial, e se aparece na página pública.
ALTER TABLE plan
  ADD COLUMN price_yearly DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER price_monthly,
  ADD COLUMN trial_days   INT NOT NULL DEFAULT 30,
  ADD COLUMN public       TINYINT(1) NOT NULL DEFAULT 1;

-- Assinaturas: intervalo (mensal/anual), fim do trial, carência e gateway manual.
ALTER TABLE subscription
  MODIFY COLUMN gateway ENUM('bancard','pagopar','manual') NULL,
  ADD COLUMN billing_interval ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly' AFTER plan_id,
  ADD COLUMN trial_ends_at DATETIME NULL,
  ADD COLUMN grace_days INT NOT NULL DEFAULT 5;

-- Histórico de pagamentos (manual ou gateway) — recibos e controle.
CREATE TABLE IF NOT EXISTS payment (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id         BIGINT UNSIGNED NOT NULL,
  subscription_id  BIGINT UNSIGNED NULL,
  plan_id          BIGINT UNSIGNED NULL,
  amount           DECIMAL(14,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'USD',
  method           ENUM('manual','bancard','pagopar') NOT NULL DEFAULT 'manual',
  billing_interval ENUM('monthly','yearly') NOT NULL DEFAULT 'monthly',
  period_start     DATETIME NULL,
  period_end       DATETIME NULL,
  paid_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference        VARCHAR(200) NULL,   -- id do gateway ou observação
  note             VARCHAR(300) NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
  INDEX idx_pay_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Planos antigos (em Guaraníes) desativados; passamos a cobrar em USD.
UPDATE plan SET active = 0 WHERE currency = 'PYG';

-- Plano padrão: US$ 100/mês, anual US$ 1.080 (−10%), 30 dias de trial.
INSERT INTO plan (slug, name, price_monthly, price_yearly, currency, trial_days, max_products, max_api_requests_per_day, active, public)
VALUES ('mensal', 'Plano Mensal', 100.00, 1080.00, 'USD', 30, 0, 0, 1, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), price_monthly = VALUES(price_monthly), price_yearly = VALUES(price_yearly),
  currency = 'USD', trial_days = VALUES(trial_days), active = 1, public = 1;
