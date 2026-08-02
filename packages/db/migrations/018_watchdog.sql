-- Guardião: vigia o robô coletor e o site, e religa quando travam.
-- Nasceu de um caso real em que o coletor ficou horas sem produzir e só foi
-- percebido dias depois — a partir de agora a falha aparece no painel.

-- Situação da última verificação (sempre 1 linha, id = 1).
CREATE TABLE IF NOT EXISTS watchdog_state (
  id            TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  last_check_at DATETIME     NULL,
  status        VARCHAR(30)  NULL,   -- ok | travado | caido | parado-pelo-usuario | reiniciando-demais
  detail        VARCHAR(500) NULL,
  checks        BIGINT       NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO watchdog_state (id, checks) VALUES (1, 0)
  ON DUPLICATE KEY UPDATE id = id;

-- Histórico só dos acontecimentos (problema detectado / ação tomada).
CREATE TABLE IF NOT EXISTS watchdog_log (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  happened_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  target     VARCHAR(40)  NOT NULL,          -- coletor | site
  status     VARCHAR(30)  NOT NULL,
  detail     VARCHAR(500) NULL,
  action     VARCHAR(60)  NULL,              -- reiniciado | nenhuma | limite-atingido
  INDEX idx_watchdog_log_quando (happened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
