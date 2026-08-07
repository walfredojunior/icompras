-- A MEMÓRIA CURTA DO GUARDIÃO.
--
-- Até aqui ele só sabia olhar o valor de agora. Em 07/08/2026 isso deu alarme
-- falso: 755 produtos quentes atrasados parecia grave, mas o número estava
-- CAINDO a cada minuto — era fila se recuperando de um incidente, não defeito.
-- Quem percebeu foi o dono, olhando duas medições seguidas. O guardião não
-- tinha como: ele não guardava a anterior.
--
-- Guardando a medição passada, "755 e caindo" e "755 e parado" deixam de ser a
-- mesma coisa. O primeiro é trabalho acontecendo; o segundo é problema.
--
-- `repeticoes` conta quantas verificações seguidas passaram SEM melhorar. É o
-- que evita gritar no primeiro solavanco: uma medição pior pode ser só o
-- instante errado (o robô acabou de recarregar a lista, por exemplo).
CREATE TABLE IF NOT EXISTS guardiao_tendencia (
  chave      VARCHAR(60)  NOT NULL,
  valor      BIGINT       NOT NULL,
  repeticoes INT UNSIGNED NOT NULL DEFAULT 0,
  medido_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
