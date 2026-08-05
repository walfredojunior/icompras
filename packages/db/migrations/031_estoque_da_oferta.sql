-- Quantidade em estoque informada pela loja na API.
--
-- Pedido do dono em 05/08/2026, ao desenhar a API compatível com a do Compras
-- Paraguai (que exige o campo `stock` em todo produto): *"talvez seja
-- interessante pra saber se o produto tem estoque, e se não tiver ele não entra
-- no iCompras"*. Ele está certo — anunciar o menor preço de algo que ninguém
-- consegue comprar irrita o visitante e queima a loja.
--
-- NULL = a loja não controla estoque (ou não informou). Nesse caso a oferta
-- continua no ar: quem não manda o campo não pode sumir do site por engano.
-- 0 = esgotado; a coluna `in_stock` que já existia passa a valer 0 junto, e é
-- ela que o site consulta.
ALTER TABLE offer
  ADD COLUMN stock INT UNSIGNED NULL AFTER in_stock;
