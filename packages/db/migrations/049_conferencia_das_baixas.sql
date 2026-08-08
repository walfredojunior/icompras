-- Placar da conferência diária das ofertas tiradas do ar.
--
-- Contexto (08/08/2026): no dia em que a marcação entrou no ar, conferi 5
-- anúncios na mão — baixei a página da fonte e cruzei os dois lados. Deu 18
-- ofertas retiradas (todas realmente ausentes) e 70 mantidas (todas realmente
-- presentes): 88 conferências, nenhum erro. Mais 3 que o dono verificou.
--
-- O problema é que aquilo foi um comando meu, avulso. Regra que decide sozinha
-- o que sai do site precisa de alguém conferindo TODO dia, e esse alguém não
-- pode ser "eu lembrar de olhar".
--
-- ⚠ AS DUAS COLUNAS SÃO IGUALMENTE IMPORTANTES.
--   `erradas`  — loja que tirei do ar e que AINDA aparece na fonte. Erro
--                direto: sumiu do site um preço que existe.
--   `mantidas_ok` / `mantidas` — das lojas que deixei no ar, quantas de fato
--                aparecem na fonte. Este lado pega o defeito silencioso: se eu
--                estivesse lendo as páginas pela metade, as que faltaram na
--                minha leitura apareceriam aqui como diferença. Sem ele, uma
--                leitura truncada passaria como "nenhum erro".
CREATE TABLE IF NOT EXISTS baixa_auditoria (
  day         DATE NOT NULL,
  conferidas  INT UNSIGNED NOT NULL DEFAULT 0,  -- ofertas retiradas que foram checadas
  erradas     INT UNSIGNED NOT NULL DEFAULT 0,  -- ...e que ainda apareciam na fonte
  mantidas_ok INT UNSIGNED NOT NULL DEFAULT 0,
  mantidas    INT UNSIGNED NOT NULL DEFAULT 0,
  anuncios    INT UNSIGNED NOT NULL DEFAULT 0,  -- quantas páginas deu tempo de baixar
  detalhe     VARCHAR(500) NULL,
  at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
