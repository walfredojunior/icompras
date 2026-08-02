-- Camada 2: dados próprios de cada oferta.
-- Cada loja anuncia uma VARIAÇÃO diferente do produto ("… - Cosmic Orange",
-- "… - Silver"), com foto e código próprios. Sem isso a lista repetia a mesma
-- foto do produto em todas as ofertas.
-- (offer já tinha url e image_url; faltavam estes dois.)
ALTER TABLE offer
  ADD COLUMN title VARCHAR(300) NULL AFTER external_id,
  ADD COLUMN code  VARCHAR(60)  NULL AFTER title;

-- Camada 3: favoritos.
-- Diferente do alerta de preço: alerta avisa quando cai abaixo de um valor;
-- favorito é só "guardar para ver depois".
CREATE TABLE IF NOT EXISTS favorite (
  user_id    BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_prod FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE,
  INDEX idx_fav_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
