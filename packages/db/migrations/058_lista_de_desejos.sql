-- Lista de desejos compartilhável.
--
-- Pedido dele em 15/08/2026: *"queria poder criar uma ou várias listas de
-- desejo... cada lista soma no final como se fosse uma lista de compra e eu
-- poder compartilhar"*. Decisão dele no mesmo dia, depois da análise:
-- **a lista vive no NAVEGADOR, sem cadastro**, e só sobe para cá quando a
-- pessoa aperta "compartilhar".
--
-- 💡 POR QUE ISSO IMPORTA: a conta foi desligada da vitrine em 31/07/2026
-- porque o alerta de preço — a única razão de alguém se cadastrar — nunca
-- funcionou. Exigir cadastro para montar uma lista repetiria o mesmo erro:
-- pedir compromisso antes de entregar valor. Sem cadastro, a pessoa monta a
-- lista no primeiro clique e o cadastro vira conveniência (não perder a
-- lista, usar no celular e no computador).
--
-- Por isso esta tabela guarda SÓ as listas compartilhadas. A grande maioria
-- das listas nunca chega aqui, e isso é o desenho funcionando, não falta.
CREATE TABLE IF NOT EXISTS lista_compartilhada (
  -- O código que vai no endereço: /lista/a7f3k9x2. Aleatório e curto o
  -- bastante para caber num WhatsApp, longo o bastante para ninguém adivinhar.
  token       VARCHAR(16)  NOT NULL,
  -- Nome que a pessoa deu ("Presentes", "Viagem de setembro").
  nome        VARCHAR(80)  NOT NULL,
  -- Os itens em JSON: [{"p": <product_id>, "q": <quantidade>, "o": "observação"}]
  --
  -- ⚠ JSON e não tabela filha DE PROPÓSITO. A lista compartilhada é uma
  -- FOTOGRAFIA do que a pessoa montou, não um cadastro vivo: ninguém edita
  -- depois de compartilhar. Tabela filha traria chave estrangeira, exclusão
  -- em cascata e junção a cada leitura, para nada. Os PREÇOS não ficam aqui —
  -- são buscados na hora de abrir, senão a lista mostraria preço velho, que é
  -- o oposto do motivo de existir um comparador.
  itens       JSON         NOT NULL,
  -- Quem criou, quando havia sessão. NULL é o caso normal (sem cadastro).
  user_id     BIGINT UNSIGNED NULL,
  criada_em   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Última vez que alguém abriu. É o que decide a limpeza automática.
  vista_em    TIMESTAMP    NULL DEFAULT NULL,
  vezes_vista INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (token),
  KEY idx_lista_limpeza (vista_em, criada_em),
  KEY idx_lista_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Recuperação de senha.
--
-- ⚠ O TOKEN É GUARDADO COMO HASH, não em texto. Se o banco vazar, os tokens
-- em texto seriam chaves de acesso prontas para todas as contas com pedido
-- aberto. Guardando o hash, o que vaza não abre nada — o mesmo raciocínio da
-- senha, que já é guardada com scrypt em `app_user`.
CREATE TABLE IF NOT EXISTS recuperacao_senha (
  token_hash  CHAR(64)     NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  expira_em   DATETIME     NOT NULL,
  -- Preenchido quando o link é usado. Serve para o link valer UMA vez só:
  -- sem isso, quem tivesse o e-mail antigo poderia trocar a senha de novo
  -- semanas depois.
  usado_em    DATETIME     NULL DEFAULT NULL,
  criado_em   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_recup_user (user_id, criado_em),
  KEY idx_recup_expira (expira_em),
  CONSTRAINT fk_recup_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
