-- 006_exchange.sql — câmbio (base USD) e preço normalizado em USD por oferta.

CREATE TABLE IF NOT EXISTS exchange_rate (
  currency   CHAR(3) NOT NULL PRIMARY KEY,
  pyg_value  DECIMAL(18,6) NOT NULL,   -- guaraníes por 1 unidade desta moeda (PYG = 1)
  buy        DECIMAL(18,6) NULL,       -- compra
  sell       DECIMAL(18,6) NULL,       -- venta (usada como pyg_value)
  source     VARCHAR(80) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Preço da oferta normalizado em dólar (para comparar/ordenar entre moedas).
ALTER TABLE offer ADD COLUMN price_usd DECIMAL(14,2) NULL AFTER currency;

-- Cotações iniciais (serão atualizadas 3x/dia pelo scraper do cambioschaco).
INSERT INTO exchange_rate (currency, pyg_value, buy, sell, source) VALUES
  ('PYG', 1,    1,    1,    'base'),
  ('USD', 6030, 5950, 6030, 'inicial'),
  ('BRL', 1170, 1130, 1170, 'inicial'),
  ('EUR', 7300, 6930, 7300, 'inicial')
ON DUPLICATE KEY UPDATE pyg_value=VALUES(pyg_value), buy=VALUES(buy), sell=VALUES(sell);

-- Backfill: converte o preço de cada oferta existente para USD.
UPDATE offer o
JOIN exchange_rate rc ON rc.currency = o.currency
JOIN exchange_rate ru ON ru.currency = 'USD'
SET o.price_usd = ROUND(o.price * rc.pyg_value / ru.pyg_value, 2)
WHERE o.price_usd IS NULL;
