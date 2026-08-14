-- Por que uma unidade de coleta NÃO terminou.
--
-- Contexto (12/08/2026): em 11/08 rodei os 157 arquivos do mapa da fonte e
-- reportei ao dono "157 de 157 concluídas". O banco contava outra história:
--
--     155 unidades -> 0 produtos, em 2 segundos cada
--       2 unidades -> 1.432 e 359 produtos, em 4.890s e 1.130s
--
-- Dois segundos é o tempo de pedir o arquivo e o pedido falhar. O coletor fazia
-- `if (!xml) break;` e seguia para `catDone`, que gravava `last_finished_at`
-- igualzinho ao de uma unidade que trabalhou. **Sucesso e fracasso ficavam
-- indistinguíveis**, e a conferência dizia "100%" com toda a confiança.
--
-- Custo: **70.570 anúncios da fonte nunca visitados** — 23% do catálogo dela.
-- Não apareceu em nenhum painel. Apareceu porque o dono comprou um óleo de
-- CBD na Flash Importados, procurou no iCompras e não achou.
--
-- 💡 `break` num caminho de erro produz o mesmo estado que o caminho feliz.
-- Todo ponto de desistência precisa registrar QUE desistiu — senão o silêncio
-- vira "está tudo bem".
--
-- Com esta coluna, a unidade que falha fica sem `last_finished_at` (volta a ser
-- sorteada) e guarda o motivo, que aparece em Admin › Robôs.
ALTER TABLE crawl_category
  ADD COLUMN last_erro VARCHAR(200) NULL AFTER last_products,
  ALGORITHM=INPLACE, LOCK=NONE;
