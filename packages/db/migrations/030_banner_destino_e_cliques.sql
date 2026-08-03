-- Banner: destino explícito do clique + contagem de cliques.
--
-- ATÉ AQUI o destino era ADIVINHADO: tem link? vai pro link; não tem, mas tem
-- loja? vai pra loja; não tem nada? não clica. A regra funcionava, mas era
-- invisível para quem cadastra — tanto que a lista do painel precisou passar a
-- escrever "para onde o clique leva" por extenso.
--
-- Com a terceira opção pedida pelo dono (banner que abre uma BUSCA pronta:
-- clicou no banner da Apple, já vê todos os Apple) adivinhar ficaria pior
-- ainda. Então o tipo de destino passa a ser ESCOLHIDO na tela.
--
-- 'auto' é o valor dos banners que já existem: mantém exatamente o
-- comportamento antigo, então nada muda para eles enquanto ninguém os editar.
ALTER TABLE banner
  ADD COLUMN destino_tipo VARCHAR(16) NOT NULL DEFAULT 'auto' AFTER link_url,
  -- O termo da busca ('busca') ou o nome exato da marca ('marca').
  -- Os outros tipos usam colunas que já existiam: link_url e store_id.
  ADD COLUMN busca VARCHAR(200) NULL AFTER destino_tipo;

-- Cliques por banner, por dia.
--
-- Mesmo formato de analytics_store_click: só contagem agregada, nada de IP nem
-- de identificador de pessoa. É o número que o anunciante vai pedir na hora de
-- renovar ("quantos cliques meu banner teve?") e que hoje não tem resposta.
CREATE TABLE IF NOT EXISTS analytics_banner_click (
  day       DATE            NOT NULL,
  banner_id BIGINT UNSIGNED NOT NULL,
  clicks    INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (day, banner_id),
  CONSTRAINT fk_abclick_banner FOREIGN KEY (banner_id) REFERENCES banner(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
