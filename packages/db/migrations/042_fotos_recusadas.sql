-- Por que a foto de um produto enviado por loja foi recusada.
--
-- Nasceu junto com a portaria de imagens (06/08/2026). A decisão do dono foi
-- "aceitar o produto e ficar sem foto" — o que é bom para o lojista, mas cria
-- um silêncio: ele manda o catálogo, tudo responde 207 sucesso, e as fotos
-- simplesmente não aparecem, sem ninguém saber por quê.
--
-- Esta tabela é o "por quê", para o dono poder dizer à loja exatamente o que
-- corrigir: "o endereço da foto do código X aponta para uma página, não para
-- uma imagem".
--
-- UNIQUE(store_id, external_id): guarda a ÚLTIMA recusa de cada produto de
-- cada loja, não uma linha por tentativa. Uma loja que reenvia o catálogo de
-- hora em hora geraria 24 linhas por dia por produto — a tabela viraria um
-- log inútil de tão grande. Aqui ela tem, no máximo, o tamanho do catálogo
-- com problema, e some sozinha quando a loja corrige (ver a limpeza no
-- worker).
CREATE TABLE IF NOT EXISTS store_image_reject (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id     INT UNSIGNED NOT NULL,
  external_id  VARCHAR(200) NOT NULL,
  url          VARCHAR(600) NULL,
  motivo       VARCHAR(40)  NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reject_store_ext (store_id, external_id),
  KEY idx_reject_store (store_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
