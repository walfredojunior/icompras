-- MONETIZAR DESTAQUES E BLOCOS DE DESTAQUE (22/08/2026)
--
-- Ele pediu o mesmo modelo dos banners: escolher o cliente, pôr o preço, o
-- valor entrar na conta a receber, e ter vencimento.
--
-- 💡 O VENCIMENTO É O QUE FALTAVA MAIS. Destaque e bloco não tinham NENHUMA
-- data: uma vez ligados, ficavam no ar até alguém lembrar de desligar — e
-- ninguém lembra. Vendido por um mês, entregue para sempre.

-- ------------------------------------------------- 1. destaque de produto
--
-- A tabela guarda um produto por linha (chave é o product_id), então as
-- colunas de venda entram nela mesma.
ALTER TABLE featured_product
  ADD COLUMN store_id  BIGINT UNSIGNED NULL AFTER position,
  ADD COLUMN is_paid   TINYINT(1) NOT NULL DEFAULT 0 AFTER store_id,
  ADD COLUMN starts_at DATETIME NULL AFTER is_paid,
  ADD COLUMN ends_at   DATETIME NULL AFTER starts_at,
  ADD CONSTRAINT fk_feat_store FOREIGN KEY (store_id) REFERENCES store (id) ON DELETE SET NULL;

-- ---------------------------------------------------- 2. bloco de destaque
ALTER TABLE category_block
  ADD COLUMN store_id  BIGINT UNSIGNED NULL AFTER active,
  ADD COLUMN is_paid   TINYINT(1) NOT NULL DEFAULT 0 AFTER store_id,
  ADD COLUMN starts_at DATETIME NULL AFTER is_paid,
  ADD COLUMN ends_at   DATETIME NULL AFTER starts_at,
  ADD CONSTRAINT fk_bloco_store FOREIGN KEY (store_id) REFERENCES store (id) ON DELETE SET NULL;

-- --------------------------------------- 3. o item de venda aponta para eles
--
-- ⚠ COLUNAS SEPARADAS, e não um par genérico (`ref_tipo` + `ref_id`).
-- O genérico parece mais elegante e perde o que mais importa aqui: a INTEGRIDADE.
-- Com coluna própria dá para ter chave estrangeira de verdade e
-- `ON DELETE SET NULL` — apagar um destaque nunca apaga a linha da venda, mas
-- também nunca deixa um vínculo apontando para o nada. Num par genérico o banco
-- não consegue garantir isso, e a limpeza vira responsabilidade de quem lembrar.
-- ⚠ Mesma armadilha do `servico`: `tipo` também é lista fechada e precisa
-- ganhar 'destaque' e 'bloco' ANTES de receber esses valores.
ALTER TABLE pedido_item
  MODIFY COLUMN tipo ENUM('banner_categoria','banner_home','destaque','bloco','plano','outro') NOT NULL;

ALTER TABLE pedido_item
  ADD COLUMN destaque_produto_id BIGINT UNSIGNED NULL AFTER banner_id,
  ADD COLUMN bloco_id            BIGINT UNSIGNED NULL AFTER destaque_produto_id,
  ADD CONSTRAINT fk_item_destaque FOREIGN KEY (destaque_produto_id)
      REFERENCES featured_product (product_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_item_bloco FOREIGN KEY (bloco_id)
      REFERENCES category_block (id) ON DELETE SET NULL;

-- ----------------------------------------------- 4. preços dos dois serviços
--
-- Preço único: nem destaque nem bloco dependem do tamanho de uma categoria.
-- ⚠ Já existia uma linha 'destaque' criada na migração 062 — o INSERT IGNORE
-- respeita a chave única (servico, slot, faixa) e não duplica.
--
-- ⚠⚠ O CAMPO `servico` É UMA LISTA FECHADA (ENUM) e não tinha 'bloco': o
-- INSERT passava sem erro e **gravava vazio**, que a chave única então recusava
-- em silêncio. Lista fechada precisa ser ampliada ANTES de receber o valor novo
-- — e o MariaDB não avisa, só não grava.
ALTER TABLE preco_tabela
  MODIFY COLUMN servico ENUM('banner_categoria','banner_home','destaque','bloco','outro') NOT NULL;

INSERT IGNORE INTO preco_tabela
  (servico, slot, faixa, descricao, valor_mensal, valor_trimestral, valor_semestral)
VALUES
  ('bloco', NULL, NULL, 'Bloco de destaque na página inicial', 80.00, 216.00, 408.00);
