-- Guarda a categoria da FONTE de onde o produto foi coletado.
-- É a informação mais confiável que temos: o site de origem já classifica o
-- produto corretamente, e o crawler entra numa categoria por vez. Antes esse
-- dado era descartado e a categoria era adivinhada por semelhança de letras,
-- o que colocava "Robô de Limpeza" em Cozinha e "Tablet" em Televisores.
ALTER TABLE product
  ADD COLUMN source_category VARCHAR(160) NULL AFTER category_id,
  ADD INDEX idx_prod_source_cat (source_category);
