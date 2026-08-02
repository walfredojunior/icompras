-- Robôs paralelos: vários coletores dividindo as categorias.
--
-- Até a v1.0 era um robô só, em fila indiana. Com o catálogo indo de 21 mil
-- para ~120 mil produtos, uma volta completa passou a levar ~12 dias — o que
-- significa preço reconferido a cada 12 dias num site de comparar preços.
--
-- A máquina estava com carga 0,12, de bobeira: o limite não era o servidor, e
-- sim a pausa de educação entre um pedido e outro à fonte. A saída é fazer
-- vários robôs trabalharem ao mesmo tempo, DIVIDINDO um teto de pedidos por
-- segundo combinado entre eles — mais rápido sem virar enxurrada.
--
-- Estas colunas são a divisão de tarefas: cada robô "reivindica" uma categoria
-- antes de começar, e os outros não pegam a mesma.
ALTER TABLE crawl_category
  ADD COLUMN claimed_by  VARCHAR(20) NULL AFTER last_products,
  -- Quando reivindicou. Funciona como ALUGUEL, não como posse: se o robô
  -- morrer no meio, a reivindicação expira sozinha depois de um tempo e outro
  -- robô assume. Sem isso, um robô que caísse deixaria a categoria travada
  -- para sempre.
  ADD COLUMN claimed_at  DATETIME    NULL AFTER claimed_by;

-- A busca do "próximo trabalho" roda a cada categoria; sem índice ela varreria
-- as 508 linhas toda vez, multiplicado pelo número de robôs.
ALTER TABLE crawl_category
  ADD INDEX idx_cc_fila (last_finished_at, claimed_at);
