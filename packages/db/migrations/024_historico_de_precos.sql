-- Histórico de preços de verdade, e a base da página de "baixaram de preço".
--
-- Por que agora: a tabela offer_price_history existia desde o começo e estava
-- com ZERO linhas. Quem gravava nela era o caminho da API (uma loja enviando a
-- própria lista de preços), e nenhuma loja faz isso. Quem mexe nos preços de
-- verdade é o robô coletor — 82 mil ofertas, revistas a cada 2,3 horas — e ele
-- trocava o preço sem registrar nada. Resultado: gráfico de histórico sempre
-- vazio e alerta de preço que nunca disparou.

-- 1) O histórico passa a guardar também o valor em dólar ----------------------
-- A fonte publica tudo em dólar, mas uma loja que entre pela API pode mandar em
-- guarani ou real. Guardando o equivalente em dólar junto, a comparação "caiu
-- de quanto para quanto" nunca depende da cotação do dia — senão o preço
-- "cairia" sozinho toda vez que o câmbio mexesse e a página encheria de queda
-- que não existiu.
ALTER TABLE offer_price_history
  ADD COLUMN price_usd DECIMAL(14,2) NULL AFTER currency;

ALTER TABLE offer_price_history
  ADD INDEX idx_hist_oferta_quando (offer_id, recorded_at);

-- 2) Gravação automática, no próprio banco -----------------------------------
-- Um GATILHO, e não código no coletor, de propósito: assim vale para TODO
-- caminho que mexa em preço — o robô hoje, a API de lojas amanhã, um acerto
-- feito na mão. Não tem como alguém esquecer de registrar.
--
-- Escrito como UM único comando (INSERT ... SELECT ... WHERE), sem BEGIN/END:
-- o aplicador de migrations manda o arquivo inteiro numa tacada só, e corpo de
-- gatilho com ponto-e-vírgula dentro é justamente o que costuma quebrar nisso.
--
-- O SELECT só devolve linha quando o preço MUDOU. O coletor confere cada preço
-- umas 10 vezes por dia; sem esse cuidado seriam 800 mil linhas diárias de
-- "continua igual".
DROP TRIGGER IF EXISTS trg_offer_preco_mudou;

CREATE TRIGGER trg_offer_preco_mudou
AFTER UPDATE ON offer
FOR EACH ROW
INSERT INTO offer_price_history (offer_id, price, currency, price_usd)
SELECT NEW.id, NEW.price, NEW.currency, NEW.price_usd FROM DUAL
 WHERE NEW.price_usd IS NOT NULL
   AND (OLD.price_usd IS NULL OR NEW.price_usd <> OLD.price_usd);

-- Oferta nova entra com o preço de estreia, para haver um ponto de partida.
DROP TRIGGER IF EXISTS trg_offer_preco_nasceu;

CREATE TRIGGER trg_offer_preco_nasceu
AFTER INSERT ON offer
FOR EACH ROW
INSERT INTO offer_price_history (offer_id, price, currency, price_usd)
SELECT NEW.id, NEW.price, NEW.currency, NEW.price_usd FROM DUAL
 WHERE NEW.price_usd IS NOT NULL;

-- 3) Ponto de partida para as 82 mil ofertas que já existem -------------------
-- Sem isto, uma oferta que nunca mais mudar de preço ficaria para sempre sem
-- nenhuma linha de histórico e sumiria de qualquer comparação.
INSERT INTO offer_price_history (offer_id, price, currency, price_usd, recorded_at)
SELECT o.id, o.price, o.currency, o.price_usd, COALESCE(o.updated_at, NOW())
  FROM offer o
 WHERE o.price_usd IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM offer_price_history h WHERE h.offer_id = o.id);

-- 4) Resumo diário por produto ------------------------------------------------
-- A página de quedas precisa responder "qual era o menor preço deste produto há
-- 7 dias". Varrer o histórico de 82 mil ofertas a cada visita seria lento; com
-- uma linha por produto por dia a resposta é imediata. São ~21 mil linhas por
-- dia, cerca de 8 milhões por ano — pouco para o banco.
CREATE TABLE IF NOT EXISTS product_price_daily (
  product_id BIGINT UNSIGNED NOT NULL,
  day        DATE            NOT NULL,
  min_usd    DECIMAL(14,2)   NOT NULL,   -- menor preço visto NAQUELE dia
  offers     INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day),
  INDEX idx_ppd_dia (day),
  CONSTRAINT fk_ppd_product FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
