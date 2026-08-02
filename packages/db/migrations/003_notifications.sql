-- 003_notifications.sql — registro de notificações enviadas (alertas de preço).

CREATE TABLE IF NOT EXISTS notification_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NULL,
  channel     ENUM('email','whatsapp') NOT NULL,
  destination VARCHAR(200) NOT NULL,
  subject     VARCHAR(200) NULL,
  body        TEXT NOT NULL,
  alert_id    BIGINT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_alert (alert_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
