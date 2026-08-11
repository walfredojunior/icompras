-- Configurações e chaves dos serviços de IA, num lugar só.
--
-- Pedido dele em 11/08/2026, ao planejar o módulo de produtos do cliente:
-- "no admin vai ter que ter um setting das IA, e aí ficar as configurações e
-- keys de cada IA". O desenho é copiado do KaruGO-Chef, que já resolveu isto
-- bem (lá em PHP/Laravel; aqui só o desenho vem junto).
--
-- Três serviços, cada um com o seu interruptor, provedor, modelo, chave e TETO:
--   texto   — descrição de produto a partir do nome (DeepSeek)
--   imagem  — geração de foto (fal.ai / OpenAI / Google)
--   busca   — procurar foto real na web (Google CSE / Bing)
--
-- ⚠ O TETO NÃO É DETALHE, É A PEÇA CENTRAL. Ele decidiu em 11/08 que **a conta
-- da IA é dele**. Serviço pago acionado por tela de cliente pode ser chamado
-- mil vezes num domingo por um laço nosso ou por alguém insistindo num botão.
-- O teto é o que transforma "prejuízo silencioso" em "parou e avisou" — a
-- mesma escolha dos tetos do coletor e das baixas de oferta.
--
-- ⚠ AS CHAVES FICAM CIFRADAS (ver lib/segredos.ts), nunca em texto puro. Aqui
-- o motivo é concreto e recente: em 10/08 a trava anti-segredo do "salve tudo"
-- recusou publicar o repositório porque havia uma senha escrita no código.
-- Chave de serviço pago em texto puro no banco é a mesma classe de erro, um
-- passo adiante.
CREATE TABLE IF NOT EXISTS ia_config (
  id                TINYINT UNSIGNED NOT NULL DEFAULT 1,

  -- TEXTO (descrições)
  texto_ativo       TINYINT(1)   NOT NULL DEFAULT 0,
  texto_provider    VARCHAR(20)  NOT NULL DEFAULT 'deepseek',
  texto_model       VARCHAR(60)  NOT NULL DEFAULT 'deepseek-chat',
  texto_key         TEXT         NULL,          -- cifrada
  texto_limite_mes  INT UNSIGNED NOT NULL DEFAULT 2000,

  -- IMAGEM GERADA
  img_ativo         TINYINT(1)   NOT NULL DEFAULT 0,
  img_provider      VARCHAR(20)  NOT NULL DEFAULT 'fal',
  img_model         VARCHAR(80)  NOT NULL DEFAULT 'fal-ai/flux/schnell',
  img_key_fal       TEXT         NULL,          -- cifrada
  img_key_openai    TEXT         NULL,          -- cifrada
  img_key_google    TEXT         NULL,          -- cifrada
  img_limite_mes    INT UNSIGNED NOT NULL DEFAULT 200,

  -- BUSCA DE FOTO REAL NA WEB
  busca_ativo       TINYINT(1)   NOT NULL DEFAULT 0,
  busca_provider    VARCHAR(20)  NOT NULL DEFAULT 'google',
  busca_key         TEXT         NULL,          -- cifrada
  busca_cx          VARCHAR(60)  NULL,          -- id do mecanismo (Google CSE)
  busca_limite_dia  INT UNSIGNED NOT NULL DEFAULT 90,

  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO ia_config (id) VALUES (1);

-- Quanto cada serviço consumiu, por dia. É o que alimenta o contador da tela e
-- o freio do teto.
--
-- ⚠ Guarda também as FALHAS. Serviço pago que começa a falhar sem ninguém ver
-- é dinheiro indo embora em tentativa — e, pior, é funcionalidade quebrada na
-- mão do cliente sem aparecer em lugar nenhum.
CREATE TABLE IF NOT EXISTS ia_uso (
  day       DATE         NOT NULL,
  servico   VARCHAR(20)  NOT NULL,   -- texto | imagem | busca
  provider  VARCHAR(20)  NOT NULL,
  chamadas  INT UNSIGNED NOT NULL DEFAULT 0,
  falhas    INT UNSIGNED NOT NULL DEFAULT 0,
  detalhe   VARCHAR(255) NULL,       -- última mensagem de erro
  PRIMARY KEY (day, servico, provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
