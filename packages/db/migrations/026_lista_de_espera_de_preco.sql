-- Lista de espera: produtos que a fonte mostrou SEM preço.
--
-- Ideia do dono do site, e a observação que a motivou está certa: em
-- 01/08/2026 o mesmo produto (Kerastase Acondicionador Elixir __4558331)
-- mostrava "US$ 67,00" de manhã e a caixa de preço vazia à tarde. O preço
-- aparece e some — provavelmente enquanto a loja atualiza a lista dela.
--
-- Antes, "sem preço" era uma sentença definitiva: o coletor descartava o
-- produto e seguia. Se ele calhasse de passar no minuto errado, aquele produto
-- ficava fora do catálogo até alguém reclamar.
--
-- Agora entra aqui e é reconferido a cada volta (~4h) por alguns dias. Basta
-- ele ter preço UMA vez nesse período para entrar no catálogo.
CREATE TABLE IF NOT EXISTS price_watchlist (
  path          VARCHAR(300) NOT NULL PRIMARY KEY,  -- /produto-slug_12345/
  external_id   VARCHAR(200) NOT NULL,
  first_seen_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_try_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tries         INT UNSIGNED NOT NULL DEFAULT 1,
  origem        VARCHAR(20)  NOT NULL DEFAULT 'categoria', -- categoria | mapa | marcas
  INDEX idx_pw_tentativa (last_try_at),
  INDEX idx_pw_entrada (first_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
