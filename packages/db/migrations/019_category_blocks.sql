-- Blocos de destaque de categorias na página inicial.
-- Cada bloco é um tema montado pelo admin ("Relógios, Moda e Acessórios") que
-- reúne VÁRIAS categorias, porque os temas que o público procura nem sempre
-- coincidem com a organização da fonte. Blocos sem produto ficam escondidos
-- sozinhos, então dá para deixar prontos antes de o catálogo encher.
CREATE TABLE IF NOT EXISTS category_block (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title_pt     VARCHAR(160) NOT NULL,
  title_es     VARCHAR(160) NULL,
  title_en     VARCHAR(160) NULL,
  subtitle_pt  VARCHAR(300) NULL,
  subtitle_es  VARCHAR(300) NULL,
  subtitle_en  VARCHAR(300) NULL,
  icon         VARCHAR(40)  NULL,   -- nome do ícone (lucide)
  position     INT          NOT NULL DEFAULT 0,
  active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_block_ordem (active, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Categorias que compõem cada bloco.
CREATE TABLE IF NOT EXISTS category_block_item (
  block_id    BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  position    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (block_id, category_id),
  CONSTRAINT fk_cbi_block FOREIGN KEY (block_id) REFERENCES category_block(id) ON DELETE CASCADE,
  CONSTRAINT fk_cbi_cat FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
