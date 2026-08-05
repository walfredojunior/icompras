-- Uso da memória de emergência (swap) no Monitor VPS.
--
-- A swap foi criada em 05/08/2026 (4 GB, swappiness 10) depois de descobrir
-- que o servidor JÁ estava matando processos por falta de memória — 92 vezes
-- no syslog, duas delas no mesmo dia, vitimando os navegadores dos robôs e
-- chegando a marcar o `pm2-root.service` como falho.
--
-- Medir a swap importa mais que medir a memória: enquanto ela estiver em zero,
-- sobra folga. **Quando ela começa a ser usada, é o aviso** de que a máquina
-- entrou no limite — e é um aviso que chega ANTES de algo morrer.
ALTER TABLE vps_metric
  ADD COLUMN swap_pct      DECIMAL(5,2) NULL AFTER mem_total_mb,
  ADD COLUMN swap_usada_mb INT UNSIGNED NULL AFTER swap_pct,
  ADD COLUMN swap_total_mb INT UNSIGNED NULL AFTER swap_usada_mb;
