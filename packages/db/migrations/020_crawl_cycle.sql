-- Progresso da volta (ciclo) do coletor.
--
-- O robô não sabe de antemão quantos produtos existem, então medir "quantos
-- produtos faltam" seria chute. O que ele sabe com exatidão é quantas
-- CATEGORIAS já fechou nesta volta — é essa a medida da barra de progresso.
--
-- O número da volta serve para o dono do site não confundir "parado em 50%"
-- com "recomeçou e está em 50% de novo": a cada volta nova o número sobe e a
-- barra troca de cor.
ALTER TABLE scrape_control
  ADD COLUMN cycle                  INT      NOT NULL DEFAULT 1 AFTER message,
  ADD COLUMN cycle_started_at       DATETIME NULL AFTER cycle,
  ADD COLUMN cycle_total            INT      NOT NULL DEFAULT 0 AFTER cycle_started_at,
  ADD COLUMN last_cycle_finished_at DATETIME NULL AFTER cycle_total,
  ADD COLUMN last_cycle_seconds     INT      NULL AFTER last_cycle_finished_at;
