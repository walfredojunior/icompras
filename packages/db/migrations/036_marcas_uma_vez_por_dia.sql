-- Quando o robô dos novos varreu as páginas de marca pela última vez.
--
-- POR QUE (05/08/2026): a volta do robô de descoberta tem duas partes muito
-- diferentes de custo:
--
--   · mapa do site  → 176 páginas, ~6 minutos, e é o caminho OFICIAL da fonte
--                     para "o que existe". É onde produto novo aparece.
--   · páginas de marca → **1.888 páginas**, mais de uma hora. Serve só para
--                     achar o que não aparece em categoria nenhuma.
--
-- Rodar as duas a cada 30 minutos fazia a volta inteira levar mais de uma hora,
-- então: (a) produto novo demorava muito mais do que precisava para entrar, e
-- (b) o robô nunca fechava uma volta, o que deixava o painel marcando
-- "atrasado" para sempre — alarme que sempre toca é alarme que ninguém olha.
--
-- Agora o mapa roda a cada volta e as marcas uma vez por dia.
ALTER TABLE crawl_robo
  ADD COLUMN marcas_em DATETIME NULL AFTER ciclos;
