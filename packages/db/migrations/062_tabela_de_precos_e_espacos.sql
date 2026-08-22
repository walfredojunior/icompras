-- TABELA DE PREÇOS + TRÊS ESPAÇOS DE BANNER POR CATEGORIA (21/08/2026)
--
-- Duas mudanças que vieram da mesma conversa:
--
-- 1. Ele quer TRÊS banners por categoria — topo, meio e fim da lista — em vez
--    de um carrossel só no topo. Comercialmente é o que mais muda: cada
--    categoria passa de 1 espaço vendável para 3, com preços diferentes.
--    E resolve um defeito do carrossel: quem chega em segundo só aparece
--    depois de 8 segundos, quando a pessoa já rolou a página — você vendia
--    dois espaços e entregava um.
--
-- 2. O preço era digitado à mão em cada venda. Ele pediu uma lista de preços
--    para escolher na hora. Sem isso, a mesma categoria sai por valores
--    diferentes conforme o dia.
--
-- 💡 MOEDA: DÓLAR. Ele confirmou que cobra em dólar — o catálogo já é em USD e
-- as lojas são paraguaias.

-- ---------------------------------------------------------------- 1. espaços
--
-- ⚠ `slot` só vale para `placement = 'category'`. Os banners que já existem
-- viram 'topo', que é onde eles aparecem hoje — nenhum sai do ar por causa
-- desta migração.
ALTER TABLE banner
  ADD COLUMN slot ENUM('topo','meio','fim') NULL DEFAULT NULL AFTER category_slug;

UPDATE banner SET slot = 'topo' WHERE placement = 'category' AND slot IS NULL;

-- A exclusividade passa a ser por (categoria + espaço + período). O índice
-- serve à consulta que pergunta "este espaço está livre nessas datas?".
CREATE INDEX ix_banner_espaco ON banner (placement, category_slug, slot, starts_at, ends_at);

-- ------------------------------------------------------- 2. tabela de preços
--
-- 💡 PREÇO POR FAIXA DE TAMANHO, e não por categoria: são 519 categorias, e
-- manter 519 preços é impossível. Mas preço único também não serve — perfume
-- tem 30.603 produtos e abajur tem algumas dezenas.
--
-- Os cortes vieram do catálogo real (medido em 21/08/2026):
--   grande  (3.000+)      →  22 categorias   ← as premium
--   media   (500 a 2.999) → 118 categorias
--   pequena (menos de 500)→ 378 categorias
CREATE TABLE IF NOT EXISTS preco_tabela (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  servico        ENUM('banner_categoria','banner_home','destaque','outro') NOT NULL,
  -- Só para banner de categoria. Nulo nos demais serviços.
  slot           ENUM('topo','meio','fim') NULL,
  faixa          ENUM('grande','media','pequena') NULL,
  descricao      VARCHAR(200) NOT NULL,
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  -- Três durações. Vender 3 ou 6 meses de uma vez, com desconto, é o que
  -- reduz a renovação mensal — o momento em que se perde cliente.
  valor_mensal      DECIMAL(14,2) NOT NULL DEFAULT 0,
  valor_trimestral  DECIMAL(14,2) NULL,
  valor_semestral   DECIMAL(14,2) NULL,
  ativo          TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_preco (servico, slot, faixa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ⚠ O HISTÓRICO SE RESOLVE SOZINHO, e é de propósito: `pedido_item.valor`
-- guarda uma CÓPIA do preço no momento da venda. Reajustar a tabela não
-- reescreve o que já foi cobrado — se o item apontasse para a tabela, mudar um
-- preço mudaria contas antigas e a conta do cliente ficaria errada.

-- Preços iniciais, em dólar. São um ponto de partida para ele ajustar na tela:
-- a proporção entre os espaços (topo 100%, meio 60%, fim 40%) vale mais que os
-- números, e em um mês os cliques dirão o preço certo.
INSERT IGNORE INTO preco_tabela (servico, slot, faixa, descricao, valor_mensal, valor_trimestral, valor_semestral) VALUES
  ('banner_categoria','topo','grande',  'Banner de categoria · topo · categoria grande',  100.00, 270.00, 510.00),
  ('banner_categoria','meio','grande',  'Banner de categoria · meio · categoria grande',   60.00, 162.00, 306.00),
  ('banner_categoria','fim','grande',   'Banner de categoria · fim · categoria grande',    40.00, 108.00, 204.00),
  ('banner_categoria','topo','media',   'Banner de categoria · topo · categoria média',    50.00, 135.00, 255.00),
  ('banner_categoria','meio','media',   'Banner de categoria · meio · categoria média',    30.00,  81.00, 153.00),
  ('banner_categoria','fim','media',    'Banner de categoria · fim · categoria média',     20.00,  54.00, 102.00),
  ('banner_categoria','topo','pequena', 'Banner de categoria · topo · categoria pequena',  25.00,  67.50, 127.50),
  ('banner_categoria','meio','pequena', 'Banner de categoria · meio · categoria pequena',  15.00,  40.50,  76.50),
  ('banner_categoria','fim','pequena',  'Banner de categoria · fim · categoria pequena',   10.00,  27.00,  51.00),
  ('banner_home', NULL, NULL,           'Banner na página inicial (carrossel)',           150.00, 405.00, 765.00),
  ('destaque',    NULL, NULL,           'Destaque de produto',                             30.00,  81.00, 153.00);

-- ------------------------------------------------------------- 3. em dólar
--
-- Nenhum pedido foi emitido ainda (zero linhas), então a troca é limpa.
ALTER TABLE pedido MODIFY COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD';
UPDATE pedido SET currency = 'USD' WHERE currency = 'BRL';

-- O item guarda de qual linha da tabela veio o preço. Só para saber a origem —
-- o valor cobrado continua sendo a cópia em `valor`.
ALTER TABLE pedido_item
  ADD COLUMN preco_id BIGINT UNSIGNED NULL AFTER valor,
  ADD COLUMN duracao ENUM('mensal','trimestral','semestral','avulso') NOT NULL DEFAULT 'avulso' AFTER preco_id,
  ADD COLUMN slot ENUM('topo','meio','fim') NULL AFTER category_slug;
