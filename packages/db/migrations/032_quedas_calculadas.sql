-- Quedas de preço já calculadas, em vez de recalculadas a cada visita.
--
-- Medido em 05/08/2026: a conta das quedas levava **1,58 segundo** e rodava
-- toda vez que alguém abria a página /quedas OU a home (o bloco "baixaram de
-- preço") OU qualquer listagem (o selo "−18%" nos cartões). Ela percorre uma
-- semana inteira de `product_price_daily` — 607 mil linhas — com função de
-- janela, para responder algo que **só muda uma vez por dia**.
--
-- Agora o coletor calcula junto com o resumo diário e a página só lê o
-- resultado: de 1,58s para milésimos.
--
-- `janela` é em dias (1, 7 ou 30), as mesmas abas da página.
CREATE TABLE IF NOT EXISTS product_price_drop (
  janela      TINYINT UNSIGNED NOT NULL,
  product_id  BIGINT UNSIGNED  NOT NULL,
  antes       DECIMAL(14,2)    NOT NULL,  -- menor preço no 1º dia da janela
  agora       DECIMAL(14,2)    NOT NULL,  -- menor preço de hoje
  pct         SMALLINT         NOT NULL,  -- % de queda, já arredondada
  offers      INT UNSIGNED     NOT NULL DEFAULT 0,
  computed_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (janela, product_id),
  -- A página lista da maior queda para a menor.
  INDEX idx_queda_ordem (janela, pct),
  CONSTRAINT fk_queda_produto FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
