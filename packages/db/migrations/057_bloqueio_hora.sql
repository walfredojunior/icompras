-- Histórico de bloqueios (403) hora a hora.
--
-- Contexto (13/08/2026): o painel mostrava **"Bloqueios (403): 401"** e o dono
-- perguntou, com razão, se o proxy estava com problema. O número assusta e não
-- responde nada, porque é um acumulado desde 08/08 — não diz QUANDO aconteceu.
--
-- Só consultando o banco deu para ver o que importava:
--
--     último 403:  11/08 às 17:19  ->  46 horas atrás, nenhum desde então
--     os 401 se concentraram entre 08/08 e 11/08 (~4,6 por hora)
--
-- Ou seja: o problema já tinha passado, e o painel continuava com cara de
-- alarme. **401 numa rajada de duas horas e 401 espalhados por cinco dias são
-- situações completamente diferentes, e o total não distingue as duas.**
--
-- 💡 Contador acumulado sem histórico envelhece mal: ele nunca desce, então
-- vira ruído permanente. Um número que só pode subir deixa de informar.
--
-- Este histórico também fecha um diagnóstico: as 155 unidades do mapa que
-- falharam caladas em 11/08 rodaram entre 12h03 e 14h10 — dentro da janela de
-- bloqueios, que só terminou às 17h19. Não foi "falha passageira" como eu
-- supus; era a fonte respondendo 403. Com o histórico à mão, essa ligação
-- apareceria na hora em vez de dois dias depois.
CREATE TABLE IF NOT EXISTS coletor_bloqueio_hora (
  -- A hora cheia (ex.: 2026-08-11 17:00:00). Uma linha por hora, só quando
  -- houve bloqueio — hora sem 403 não gera linha, e o painel completa com zero.
  hora       DATETIME    NOT NULL,
  -- Por onde a coleta estava saindo quando levou o bloqueio. Separar importa:
  -- levar 403 saindo pelo proxy é bem diferente de levar saindo direto.
  modo       VARCHAR(10) NOT NULL DEFAULT 'proxy',
  -- Qual endereço estava em uso. Permite ver se o bloqueio acompanha o IP
  -- (bloqueio por endereço) ou continua depois da troca (por comportamento).
  ip         VARCHAR(45) NULL,
  quantos    INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (hora, modo),
  KEY idx_bloqueio_hora (hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
