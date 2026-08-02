-- Registro de cada vez que a fonte mandou o coletor esperar.
--
-- Até 02/08/2026 o coletor IGNORAVA o código 429 ("você está pedindo rápido
-- demais") — seguia no mesmo ritmo, que é como um aviso vira bloqueio. Agora
-- ele obedece, e cada obediência fica registrada aqui.
--
-- Serve de termômetro: enquanto isto estiver vazio, o ritmo está confortável
-- para a fonte. Se começar a encher, é sinal de que estamos apertando demais e
-- de que convém baixar o CRAWL_RPS antes que alguém do outro lado repare.
CREATE TABLE IF NOT EXISTS crawl_freio (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  happened_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  worker      VARCHAR(20)  NULL,          -- qual robô levou a recusa
  status      SMALLINT     NOT NULL,      -- 429 (rápido demais) ou 503 (sobrecarga)
  espera_ms   INT UNSIGNED NOT NULL,      -- quanto a fonte pediu de espera
  url         VARCHAR(400) NULL,
  INDEX idx_freio_quando (happened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
