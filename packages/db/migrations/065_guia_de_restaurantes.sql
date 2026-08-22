-- "ONDE COMER NO PARAGUAI" VIRA UM GUIA (22/08/2026)
--
-- Em 21/08 isto era uma FAIXA DE BANNERS na home: título, imagem, link e cidade.
-- Ele decidiu transformar em guia de verdade — bloco na home que leva a uma
-- página com todos os restaurantes, e três espaços de anúncio dentro dela.
--
-- ⚠⚠ POR QUE UMA TABELA PRÓPRIA, e não continuar como `banner`.
--
-- Ele vai cobrar DUAS coisas: estar na lista e anunciar em cima dela. Se a
-- listagem fosse só uma imagem que leva ao Instagram, **ela seria o banner** —
-- e o cliente perguntaria por que paga duas vezes pela mesma coisa.
--
-- E tem o Google: **ele não lê o que está escrito dentro de uma imagem**. Com os
-- dados em texto, a página responde "onde comer em Ciudad del Este" e traz
-- visitante NOVO. Como figura, seria invisível para busca — serviria só para
-- quem já está no site, que é o que a faixa antiga já fazia.
--
-- 💡 SEM PREÇO e SEM HORÁRIO, de propósito (decisão dele, e concordo): os dois
-- mudam o tempo todo e ninguém teria como manter atualizado. Valor errado no
-- site vira reclamação contra o iCompras — a pessoa viaja, chega lá e o almoço
-- custa o dobro. O site compara preço de PRODUTO, com número que vem da fonte;
-- preço de restaurante seria palpite escrito à mão.

CREATE TABLE IF NOT EXISTS restaurante (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(160) NOT NULL,
  -- Para a URL da ficha individual, quando ela existir (passo seguinte).
  slug        VARCHAR(180) NOT NULL,
  foto_url    VARCHAR(500) NULL,
  cidade      VARCHAR(80) NOT NULL,
  -- ⚠ LISTA FECHADA, não texto livre. Com texto livre um cadastro vira
  -- "Churrascaria", outro "churrasco" e outro "Carnes" — e o filtro para de
  -- funcionar, porque o site trata os três como coisas diferentes.
  tipo        ENUM('churrascaria','comida-caseira','japonesa','pizzaria','lanchonete',
                   'padaria','sorveteria','buffet','arabe','italiana','outros')
              NOT NULL DEFAULT 'outros',
  -- O link principal: Instagram, Facebook ou site. A tela reconhece qual é pelo
  -- endereço e mostra o botão certo — ele avisou em 04/08 que restaurante quase
  -- nunca tem site, é rede social.
  link        VARCHAR(600) NULL,
  -- Separado do principal: são os DOIS botões que a pessoa realmente aperta —
  -- um para ver as fotos da comida, outro para reservar ou perguntar de mesa.
  whatsapp    VARCHAR(40) NULL,
  endereco    VARCHAR(240) NULL,
  descricao   VARCHAR(400) NULL,

  -- ---- venda: mesma estrutura dos banners, destaques e blocos ----
  store_id    BIGINT UNSIGNED NULL,
  is_paid     TINYINT(1) NOT NULL DEFAULT 0,
  -- Aparece no topo da lista, com selo. É o item mais fácil de vender depois
  -- que alguém já está listado, e não exige arte nenhuma do cliente.
  destaque    TINYINT(1) NOT NULL DEFAULT 0,
  starts_at   DATETIME NULL,
  ends_at     DATETIME NULL,

  position    INT NOT NULL DEFAULT 0,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_restaurante_slug (slug),
  KEY ix_restaurante_lista (active, cidade, tipo),
  KEY ix_restaurante_venda (is_paid, ends_at),
  CONSTRAINT fk_restaurante_store FOREIGN KEY (store_id) REFERENCES store (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- O item de venda pode apontar para um restaurante (a LISTAGEM), do mesmo jeito
-- que já aponta para banner, destaque e bloco.
ALTER TABLE pedido_item
  ADD COLUMN restaurante_id BIGINT UNSIGNED NULL AFTER bloco_id,
  ADD CONSTRAINT fk_item_restaurante FOREIGN KEY (restaurante_id)
      REFERENCES restaurante (id) ON DELETE SET NULL;

-- ⚠ Listas fechadas precisam ser ampliadas ANTES de receber o valor novo — o
-- MariaDB não avisa, só grava vazio (aprendido na migração 064).
ALTER TABLE pedido_item
  MODIFY COLUMN tipo ENUM('banner_categoria','banner_home','destaque','bloco',
                          'restaurante','restaurante_destaque','plano','outro') NOT NULL;

-- ⚠⚠ O ALTER VEM ANTES DO INSERT — e eu errei isto aqui mesmo, na primeira
-- tentativa desta migração (22/08/2026), depois de ter documentado a armadilha
-- na 064 no dia anterior. Os dois INSERT de 'restaurante' passaram sem erro
-- nenhum e **não gravaram nada**, porque o valor não existia na lista ainda.
-- Documentar não basta: a ordem tem de estar certa no arquivo.
ALTER TABLE preco_tabela
  MODIFY COLUMN servico ENUM('banner_categoria','banner_home','destaque','bloco',
                             'restaurante','restaurante_destaque','banner_onde_comer','outro') NOT NULL;

-- Os três produtos do guia. Valores iniciais em dólar, para ele ajustar na tela.
INSERT IGNORE INTO preco_tabela
  (servico, slot, faixa, descricao, valor_mensal, valor_trimestral, valor_semestral)
VALUES
  ('restaurante', NULL, NULL, 'Onde comer · estar na lista', 20.00, 54.00, 102.00),
  ('restaurante_destaque', NULL, NULL, 'Onde comer · destaque no topo da lista', 35.00, 94.50, 178.50);

-- O BANNER DA PÁGINA DE RESTAURANTES — serviço próprio, com os três espaços.
--
-- ⚠ NÃO reaproveitar 'banner_categoria' aqui, ainda que a página use o mesmo
-- componente de exibição: o preço daquele serviço depende da FAIXA (tamanho da
-- categoria), que não existe para restaurante. Uma linha com faixa nula
-- conviveria com as de faixa preenchida sem a chave única reclamar — e a busca
-- de preço passaria a depender de qual veio primeiro.
INSERT IGNORE INTO preco_tabela
  (servico, slot, faixa, descricao, valor_mensal, valor_trimestral, valor_semestral)
VALUES
  ('banner_onde_comer', 'topo', NULL, 'Onde comer · banner do topo', 60.00, 162.00, 306.00),
  ('banner_onde_comer', 'meio', NULL, 'Onde comer · banner do meio', 36.00,  97.20, 183.60),
  ('banner_onde_comer', 'fim',  NULL, 'Onde comer · banner do fim',  24.00,  64.80, 122.40);
