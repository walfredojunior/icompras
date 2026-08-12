-- Relógio compartilhado entre os 4 robôs, para tarefa cara não rodar demais.
--
-- Contexto (12/08/2026): o site ficou levando **18 segundos** para abrir a
-- home. A causa não era o site — era o Meilisearch **reindexando os 279.798
-- produtos a cada 25 segundos**, sem parar:
--
--     11:45:21 → 279.791 documentos
--     11:45:51 → 279.791
--     11:47:11 → 279.798
--     11:47:36 → 279.798
--
-- `refreshCatalog()` chama `syncProducts()`, que reindexa o catálogo INTEIRO,
-- e é executada por cada robô ao terminar uma unidade de trabalho. Com quatro
-- robôs isso já era desperdício; depois que acrescentei os 157 arquivos do
-- mapa da fonte (11/08), eles passaram a terminar unidades muito mais vezes e
-- o desperdício virou 38% de processador ocupado em tempo integral.
--
-- ⚠ A ineficiência era ANTIGA. O que eu fiz foi ampliá-la até doer — e é assim
-- que ela apareceu. Vale como aviso: acrescentar trabalho ao coletor pode
-- multiplicar um custo que já existia e ninguém via.
--
-- Esta tabela é o relógio comum. O robô só executa a tarefa se conseguir
-- "pegar a vez" com um UPDATE condicional — que é atômico, então dos quatro
-- robôs exatamente um ganha.
CREATE TABLE IF NOT EXISTS tarefa_periodica (
  nome       VARCHAR(40) NOT NULL,
  ultima_em  DATETIME    NOT NULL DEFAULT "1970-01-01",
  PRIMARY KEY (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO tarefa_periodica (nome) VALUES ("sync-busca");
