-- Qual IP o coletor está usando AGORA, e quantas vezes ele mudou.
--
-- Contexto (08/08/2026): o dono pediu, ao montar o proxy, "quero no monitor
-- quantas vezes trocou de IP pra eu saber". O painel mostrava **zero** — e o
-- registro de Dallas tinha SETE trocas naquele mesmo dia.
--
-- Não era defeito do rodízio: ele funciona. Era o contador olhando para o
-- lugar errado. A coluna `trocas` da migração 046 conta quantas vezes o
-- coletor trocou de CAMINHO (Dallas caiu → saiu pela VPS → voltou), que é
-- outra coisa. As trocas de IP acontecem dentro de Dallas, pelo rodízio da
-- Mullvad, e o iCompras nunca ficava sabendo.
--
-- Como o iCompras passa a saber, sem abrir porta nem inventar segredo: o
-- guardião pergunta "por qual IP eu estou saindo?" ATRAVÉS DO PRÓPRIO PROXY,
-- de 5 em 5 minutos. Mudou em relação ao anterior, contou uma troca. É a
-- medida do ponto de vista de quem importa — o coletor —, e não depende de
-- Dallas conseguir alcançar o iCompras.
--
-- ⚠ Limite conhecido e aceito: duas trocas dentro do mesmo intervalo de 5
-- minutos contam como uma. Em 08/08 aconteceu (duas em 2 segundos, durante um
-- bloqueio). Como o rodízio normal é de 5 em 5 HORAS, o erro é raro e sempre
-- para menos — nunca infla o número.
ALTER TABLE coletor_saida
  ADD COLUMN ip_atual        VARCHAR(45)      NULL DEFAULT NULL AFTER modo,
  ADD COLUMN trocas_ip       INT UNSIGNED NOT NULL DEFAULT 0    AFTER ip_atual,
  ADD COLUMN ultima_troca_ip TIMESTAMP        NULL DEFAULT NULL AFTER trocas_ip,
  ADD COLUMN ip_visto_em     TIMESTAMP        NULL DEFAULT NULL AFTER ultima_troca_ip;
