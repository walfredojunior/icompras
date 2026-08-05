-- Amostras de saúde da VPS, uma por minuto.
--
-- Pedido do dono em 05/08/2026, e a primeira olhada já mostrou por que ele
-- estava certo: naquele momento a carga estava em **6,40 com 2 processadores**
-- (três vezes a capacidade) e a memória em **81%**, com 1,5 GB livres — e não
-- havia como ele saber disso. Em 31/07 a carga era 0,24.
--
-- Uma amostra por minuto = 1.440 por dia. Guardando 90 dias são ~130 mil
-- linhas: nada perto das 620 mil de histórico de preço que já existem. A
-- limpeza do que passa de 90 dias fica no guardião.
CREATE TABLE IF NOT EXISTS vps_metric (
  at            DATETIME     NOT NULL PRIMARY KEY,
  -- Percentuais já calculados: a leitura crua do Linux é acumulada desde o
  -- boot e só faz sentido como diferença entre duas amostras.
  cpu_pct       DECIMAL(5,2) NULL,
  mem_pct       DECIMAL(5,2) NULL,
  mem_usada_mb  INT UNSIGNED NULL,
  mem_total_mb  INT UNSIGNED NULL,
  disco_pct     DECIMAL(5,2) NULL,
  disco_usado_gb DECIMAL(8,2) NULL,
  disco_total_gb DECIMAL(8,2) NULL,
  -- Carga: quantos processos disputam a CPU. Acima do número de núcleos (2
  -- nesta máquina) significa fila.
  carga1        DECIMAL(6,2) NULL,
  carga5        DECIMAL(6,2) NULL,
  carga15       DECIMAL(6,2) NULL,
  rede_rx_kbs   INT UNSIGNED NULL,
  rede_tx_kbs   INT UNSIGNED NULL,
  INDEX idx_vps_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
