-- MARCA DO QUE UM PROCESSO EM MASSA MUDOU — para poder desfazer.
--
-- ⚠ POR QUE ESTA TABELA EXISTE (16/08/2026). Ontem o categorizador por IA
-- errou em massa (secadores de cabelo viraram "informática") e, na hora de
-- voltar atrás, **só deu para recuperar 192 dos 500 produtos**: o robô gravava
-- a categoria nova por cima da antiga sem deixar rastro de qual era a antiga.
-- O estrago não foi grande porque paramos cedo, mas foi cego.
--
-- Regra que fica: todo processo que altera muitos produtos de uma vez ESCREVE
-- AQUI antes de alterar. Uma linha por produto tocado, com o valor de antes.
-- Desfazer vira uma consulta, não uma arqueologia.
CREATE TABLE IF NOT EXISTS alteracao_massa (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  -- Qual processo fez. Ex.: 'recuperar-categoria', 'categorizador-ia'.
  processo      VARCHAR(60)  NOT NULL,
  -- A rodada. Mesmo processo rodado em dois dias = dois lotes, e dá para
  -- desfazer só o de ontem sem tocar no de hoje.
  lote          VARCHAR(40)  NOT NULL,
  tabela        VARCHAR(60)  NOT NULL DEFAULT 'product',
  registro_id   BIGINT       NOT NULL,
  campo         VARCHAR(60)  NOT NULL,
  -- NULL é um valor legítimo aqui: "antes não tinha categoria nenhuma".
  valor_antes   VARCHAR(200) NULL,
  valor_depois  VARCHAR(200) NULL,
  -- De onde saiu o valor novo, para auditar sem reabrir o código.
  origem        VARCHAR(200) NULL,
  criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_lote (processo, lote),
  KEY idx_registro (tabela, registro_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ONDE O PROCESSO PAROU.
--
-- 142 mil páginas levam horas. O processo precisa poder ser interrompido
-- (reinício da máquina, publicação, fonte fora do ar) e continuar de onde
-- parou, em vez de recomeçar do zero e refazer trabalho já feito.
CREATE TABLE IF NOT EXISTS processo_estado (
  nome        VARCHAR(60) PRIMARY KEY,
  posicao     BIGINT      NOT NULL DEFAULT 0,
  feitos      BIGINT      NOT NULL DEFAULT 0,
  alterados   BIGINT      NOT NULL DEFAULT 0,
  falhas      BIGINT      NOT NULL DEFAULT 0,
  lote        VARCHAR(40) NULL,
  atualizado  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
