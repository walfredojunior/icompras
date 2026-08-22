-- "ONDE COMER NO PARAGUAI" — faixa de restaurantes na home (21/08/2026)
--
-- Ideia dele, analisada em 04/08 e pausada; retomada agora que existe onde
-- cobrar (tabela de preços + conta do cliente, feitos nesta semana).
--
-- 💡 POR QUE RESTAURANTE E NÃO OUTRA COISA: não concorre com nada do site.
-- Vender banner para loja de eletrônicos é delicado — ela aparece na comparação
-- de preços e pode achar que pagar melhora a posição. Restaurante é dinheiro
-- sem sombra sobre a neutralidade, e acerta o público real: brasileiro que
-- atravessa para comprar e almoça lá no mesmo dia.

-- ⚠ A CIDADE DESDE O PRIMEIRO CADASTRO, mesmo sem uso imediato.
--
-- Quem vai a Ciudad del Este não vai almoçar em Salto del Guairá. Enquanto
-- houver poucos restaurantes, a faixa mostra todos; quando houver mais, ela
-- precisa filtrar — e acrescentar a coluna depois obrigaria a voltar em cada
-- cadastro para preencher à mão. Guardar agora custa nada.
ALTER TABLE banner
  ADD COLUMN cidade VARCHAR(80) NULL AFTER category_slug;

-- Preço do espaço "Onde comer".
--
-- ⚠ SERVIÇO PRÓPRIO, fora das faixas de categoria: restaurante não tem
-- categoria nem produto, então "categoria grande/média/pequena" não diz nada
-- aqui. Preço único, nas três durações.
INSERT IGNORE INTO preco_tabela
  (servico, slot, faixa, descricao, valor_mensal, valor_trimestral, valor_semestral)
VALUES
  ('outro', NULL, NULL, 'Onde comer no Paraguai · faixa de restaurante', 40.00, 108.00, 204.00);
