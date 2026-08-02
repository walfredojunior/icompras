-- 011_scrape_control.sql — ligar/desligar o crawler pelo painel (controle cooperativo).

CREATE TABLE IF NOT EXISTS scrape_control (
  id             TINYINT NOT NULL PRIMARY KEY,
  state          VARCHAR(16) NOT NULL DEFAULT 'idle',  -- idle | running | stopping
  stop_requested TINYINT NOT NULL DEFAULT 0,
  pid            INT NULL,
  message        VARCHAR(255) NULL,
  started_at     TIMESTAMP NULL DEFAULT NULL,
  heartbeat_at   TIMESTAMP NULL DEFAULT NULL,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO scrape_control (id, state) VALUES (1, 'idle')
  ON DUPLICATE KEY UPDATE id = id;
