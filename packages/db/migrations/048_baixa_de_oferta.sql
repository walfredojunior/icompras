-- Oferta que a loja parou de anunciar sai do ar (mas não some do banco).
--
-- Contexto (08/08/2026): até hoje, produto que a loja deixava de vender ficava
-- no iCompras PARA SEMPRE. O campo `in_stock` existia desde a migração 001 e
-- **nunca foi escrito com 0**: as 321.449 ofertas estavam todas marcadas como
-- disponíveis, inclusive as não vistas havia semanas.
--
-- Medido antes de mexer: 5.497 produtos (2,2%) com TODAS as ofertas passando
-- de 7 dias, e 453 onde o menor preço mostrado vinha de uma oferta fantasma —
-- o preço de verdade era, em média, 9% mais caro. Parece pouco porque o site
-- tem cinco semanas; como nada expirava, isso só crescia.
--
-- ⚠ MARCA, NÃO APAGA. O histórico de preço daquela oferta continua valendo, e
-- oferta que volta a aparecer (promoção que retorna, estoque que chega) é
-- reaproveitada em vez de recriada — o histórico não se parte ao meio.
ALTER TABLE offer
  -- Quando saiu do ar. NULL = está no ar.
  ADD COLUMN gone_at     DATETIME NULL DEFAULT NULL AFTER in_stock,
  -- Por quê:
  --   'ausente' — o coletor LEU a página e a loja não estava mais na lista.
  --               É a marcação exata: não espera prazo, não adivinha.
  --   'tempo'   — ninguém a viu por muito tempo. É a rede de segurança para o
  --               que o coletor não consegue nem abrir (página que virou 404).
  ADD COLUMN gone_reason ENUM('ausente','tempo') NULL DEFAULT NULL AFTER gone_at,
  -- Quando VOLTOU. É o número mais importante do monitor: se muita oferta
  -- volta, a regra está tirando do ar o que era bom, e o prazo tem que subir.
  --
  -- Por que uma coluna e não um contador: preenchida dentro do mesmo INSERT
  -- que o coletor já faz, sem consulta extra nenhuma. Com 224 mil produtos por
  -- volta, uma consulta a mais por produto seria 224 mil consultas a mais.
  ADD COLUMN voltou_at   DATETIME NULL DEFAULT NULL AFTER gone_reason,
  -- Para o monitor contar rápido sem varrer as 321 mil.
  ADD INDEX idx_offer_baixa (in_stock, gone_at),
  ADD INDEX idx_offer_volta (voltou_at);
