-- Análise de produto: a loja revisa e libera o que aparece no iCompras.
--
-- Pedido dele em 11/08/2026: "tem cliente que tem sistema antigo e não tem
-- foto, então quero um módulo pro cliente que ele pode manipular a lista dele
-- e ir liberando os produtos". Hoje a lista enviada pela API entra direto no
-- site — produto sem foto e sem descrição junto.
--
-- ⚠ DECISÃO DELE, 11/08: liga a análise e só o que CHEGAR DEPOIS fica retido.
-- O que a loja já tem publicado continua no ar. O contrário faria 500 ofertas
-- sumirem do site no instante em que ele ligasse o interruptor, e o cliente
-- ligaria reclamando com razão.
ALTER TABLE store
  ADD COLUMN analise_ativa TINYINT(1) NOT NULL DEFAULT 0 AFTER is_lead;

-- ⚠ O PORTÃO DE VISIBILIDADE CONTINUA SENDO O `in_stock`, e só ele.
--
-- A tentação era criar um campo novo ("liberado"). Não criei de propósito:
-- existem **dez lugares** no código que leem oferta (produto, busca,
-- categoria, loja, favoritos, banners, quedas, prioridade, API pública,
-- painel). Todos já filtram `in_stock = 1`. Um portão novo precisaria ser
-- lembrado nos dez, e **esquecer um significa publicar no site produto que o
-- cliente não liberou** — exatamente o que este módulo existe para impedir.
--
-- Então o estado da oferta se lê assim:
--   in_stock = 1                          → no ar
--   in_stock = 0, gone_reason = 'analise'  → esperando a loja liberar
--   in_stock = 0, gone_reason = 'excluida' → a loja decidiu não publicar
--   in_stock = 0, gone_reason = 'ausente'/'tempo' → sumiu da fonte (coletor)
ALTER TABLE offer
  MODIFY COLUMN gone_reason ENUM('ausente','tempo','analise','excluida') NULL DEFAULT NULL;
