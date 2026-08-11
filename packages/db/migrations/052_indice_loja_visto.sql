-- Índice para a tela de clientes potenciais (Admin › Leads).
--
-- Contexto (11/08/2026): a tela ficou pendurada e o dono relatou "clico em
-- lojas leads e não acontece nada". Medido: **10,47 s** e **9,68 s** por
-- consulta, três delas na mesma página — uns 30 segundos de espera. A página
-- não estava quebrada; estava esperando.
--
-- A causa: `GROUP BY store_id` sobre as 343.833 ofertas, varrendo a tabela
-- inteira para produzir 161 linhas (uma por loja). O índice `idx_offer_store`
-- já existia, mas só com `store_id` — para saber a ÚLTIMA vez que cada loja
-- foi vista, o banco ainda precisava ler cada linha.
--
-- Com `(store_id, last_seen_at)` o `MAX(last_seen_at)` por loja sai do próprio
-- índice, sem tocar nas linhas.
--
-- ⚠ `LOCK=NONE` de propósito: a tabela `offer` é escrita o tempo todo pelos 4
-- coletores. Se por algum motivo esta criação não puder ser feita sem travar,
-- é melhor que ela FALHE do que trave a tabela — em 07/08/2026 uma operação
-- longa em `offer` derrubou um robô por 3h44 e engasgou o site.
ALTER TABLE offer
  ADD INDEX idx_offer_loja_visto (store_id, last_seen_at),
  ALGORITHM=INPLACE, LOCK=NONE;
