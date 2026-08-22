-- PEDIDO DE VENDA — a conta-corrente do cliente (21/08/2026)
--
-- POR QUE EXISTE. Até aqui o sistema só sabia cobrar assinatura: uma loja, um
-- plano, um valor. Ele quer vender espaço de banner por categoria e "outros
-- serviços", com mais de um item por cliente, e lançar o que cobrou ou vai
-- cobrar na conta dele. Isso não cabe em `subscription`/`payment`, que exigem
-- um plano por trás.
--
-- 💡 A separação é entre O QUE FOI VENDIDO (aqui) e ONDE APARECE (a tabela
-- `banner`). O banner passa a ser a CONSEQUÊNCIA de um item vendido — e é o
-- item que carrega as datas, o valor e o cliente.
--
-- ⚠ MOMENTO CERTO PARA FAZER ISTO: há 163 lojas cadastradas, 1 assinatura
-- ativa e ZERO pagamentos registrados. Não existe histórico para migrar, então
-- dá para desenhar do jeito certo agora — o que não seria verdade daqui a um
-- ano.

-- ⚠ TIPOS: as chaves do projeto são BIGINT UNSIGNED. Chave estrangeira exige
-- tipo IDÊNTICO — com BIGINT sem `unsigned` o MariaDB recusa a tabela com
-- "Foreign key constraint is incorrectly formed", mensagem que não diz qual é
-- a coluna errada. Custou uma tentativa em 21/08/2026.

CREATE TABLE IF NOT EXISTS pedido (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  store_id      BIGINT UNSIGNED NOT NULL,
  -- Numeração visível para o cliente. Separada do id porque o id é detalhe do
  -- banco e um dia pode haver mais de uma série.
  numero        VARCHAR(30) NOT NULL,
  status        ENUM('rascunho','aberto','pago','cancelado') NOT NULL DEFAULT 'rascunho',
  currency      CHAR(3) NOT NULL DEFAULT 'BRL',
  -- Data do acerto e observação livre (como foi combinado, quem falou com quem).
  emitido_em    DATE NULL,
  observacao    VARCHAR(500) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pedido_numero (numero),
  KEY ix_pedido_store (store_id, status),
  CONSTRAINT fk_pedido_store FOREIGN KEY (store_id) REFERENCES store (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cada linha da nota: um serviço, um período, um valor.
CREATE TABLE IF NOT EXISTS pedido_item (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id     BIGINT UNSIGNED NOT NULL,
  -- O que foi vendido. 'banner_categoria' é o primeiro; os outros ficam
  -- prontos para quando ele vender destaque na home ou serviço avulso.
  tipo          ENUM('banner_categoria','banner_home','destaque','plano','outro') NOT NULL,
  descricao     VARCHAR(300) NOT NULL,
  -- Preenchido só quando o item é de categoria. Guardo o slug (e não o id)
  -- porque é assim que o banner referencia a categoria.
  category_slug VARCHAR(160) NULL,
  -- O banner que este item colocou no ar. Nulo enquanto não foi criado.
  -- ⚠ ON DELETE SET NULL, e não CASCADE: apagar um banner NUNCA pode apagar a
  -- linha de uma venda — o dinheiro cobrado tem de continuar registrado.
  banner_id     BIGINT UNSIGNED NULL,
  inicio        DATE NULL,
  fim           DATE NULL,
  valor         DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_item_pedido (pedido_id),
  KEY ix_item_categoria (category_slug, inicio, fim),
  CONSTRAINT fk_item_pedido FOREIGN KEY (pedido_id) REFERENCES pedido (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_banner FOREIGN KEY (banner_id) REFERENCES banner (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- O que o cliente pagou. Fica separado dos itens porque um pagamento pode
-- quitar o pedido inteiro ou uma parte, e em datas diferentes.
--
-- 💡 NÃO é cobrança automática. É o registro do que ele recebeu, do jeito que
-- ele já cobra hoje. Automatizar gateway com 1 assinatura ativa seria resolver
-- um problema que ainda não existe.
CREATE TABLE IF NOT EXISTS pedido_pagamento (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pedido_id     BIGINT UNSIGNED NOT NULL,
  valor         DECIMAL(14,2) NOT NULL,
  pago_em       DATE NOT NULL,
  forma         VARCHAR(60) NULL,
  observacao    VARCHAR(300) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_pag_pedido (pedido_id),
  CONSTRAINT fk_pag_pedido FOREIGN KEY (pedido_id) REFERENCES pedido (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
