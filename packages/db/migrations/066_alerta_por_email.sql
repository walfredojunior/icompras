-- ALERTA POR E-MAIL QUANDO A COLETA OU O PROXY FICAM FORA (22/08/2026)
--
-- Pedido dele, no mesmo dia em que o proxy passou TRÊS DIAS fora e ele só
-- descobriu olhando o painel: "quando falhar a coleta e também o proxy falhar
-- por mais de uma hora, me envia um e-mail com um alerta".
--
-- ⚠⚠ O PROBLEMA DE VERDADE NÃO É DETECTAR, É NÃO VIRAR SPAM.
--
-- O guardião roda a cada 5 minutos. Se ele mandasse e-mail sempre que visse o
-- problema, um fim de semana com o proxy caído renderia **864 e-mails** — e
-- caixa cheia de alerta repetido é caixa que a pessoa passa a ignorar, que é
-- justamente o oposto do que se quer.
--
-- 💡 Esta tabela guarda UM registro por tipo de problema, com desde quando ele
-- dura e quando foi o último aviso. Assim o alerta sai UMA vez por episódio.
CREATE TABLE IF NOT EXISTS alerta_estado (
  -- 'coleta' ou 'proxy'. Um registro por assunto, criado na primeira ocorrência.
  tipo          VARCHAR(40) NOT NULL PRIMARY KEY,
  -- Desde quando o problema dura SEM INTERRUPÇÃO. Zerado quando normaliza — é
  -- o que permite a regra de "mais de uma hora".
  ruim_desde    DATETIME NULL,
  -- Quando saiu o último e-mail deste episódio. Nulo = ainda não avisei.
  avisado_em    DATETIME NULL,
  -- Quantos e-mails já saíram neste episódio (o de abertura e os de lembrete).
  avisos        INT NOT NULL DEFAULT 0,
  -- O que estava acontecendo, para o e-mail contar e para o painel mostrar.
  detalhe       VARCHAR(400) NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO alerta_estado (tipo) VALUES ('coleta'), ('proxy');
