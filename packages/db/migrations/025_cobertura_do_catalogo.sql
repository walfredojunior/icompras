-- Cobertura do catálogo: quanto do que existe na fonte já está aqui.
--
-- Nasceu de uma pergunta que o dono do site fez duas vezes ("está faltando
-- produto?") e que, até 01/08/2026, só tinha resposta depois de meia hora de
-- investigação manual. Agora a resposta fica gravada e aparece no painel.
--
-- A conta vem do MAPA DO SITE da fonte (sitemap.xml) — a lista que ela própria
-- publica para os buscadores, e portanto a verdade sobre o que existe lá.
-- Quem preenche é o coletor, ao fim de cada volta (~4h).
--
-- Uma linha só, id = 1.
CREATE TABLE IF NOT EXISTS catalog_coverage (
  id               TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  checked_at       DATETIME     NULL,
  source_total     INT UNSIGNED NOT NULL DEFAULT 0,  -- produtos no mapa da fonte
  seen_total       INT UNSIGNED NOT NULL DEFAULT 0,  -- que o coletor já visitou
  missing_total    INT UNSIGNED NOT NULL DEFAULT 0,  -- nunca visitados
  -- Dos que faltam, quantos têm loja vendendo. É o número que importa: página
  -- sem loja nenhuma é só histórico que a fonte mantém no ar, não é catálogo.
  -- Só a auditoria de domingo preenche (exige abrir produto por produto).
  missing_sellable INT UNSIGNED NULL,
  status           VARCHAR(30)  NOT NULL DEFAULT 'ok', -- ok | faltando | mapa-inacessivel | mapa-suspeito
  detail           VARCHAR(500) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO catalog_coverage (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id;
