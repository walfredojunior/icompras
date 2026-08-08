-- Por onde o coletor está saindo, e por quê.
--
-- Contexto (07/08/2026): o dono montou um servidor em Dallas com VPN e proxy,
-- para o caso de a fonte bloquear o IP da VPS. Mas de nada adianta ter a saída
-- pronta se ninguém percebe o bloqueio — e até aqui **um 403 era invisível**:
-- `if (!res.ok) return null` tratava "você está bloqueado" igual a "essa página
-- não existe". O coletor seguiria rodando, marcando produtos como visitados e
-- colhendo zero, com o painel todo verde.
--
-- Esta tabela é o que o painel mostra: se está saindo direto ou pelo proxy,
-- quantas vezes trocou e quantos bloqueios levou. Uma linha só (id = 1).
--
-- `trocas` é o número que o dono pediu ver: "quero no monitor quantas vezes
-- trocou de ip pra eu saber". Ele conta mais do que parece — 2 trocas numa
-- semana é normal; 2 por hora significa que o bloqueio NÃO é por IP, e trocar
-- só está queimando endereço.
CREATE TABLE IF NOT EXISTS coletor_saida (
  id            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  modo          ENUM('direto','proxy') NOT NULL DEFAULT 'direto',
  trocas        INT UNSIGNED NOT NULL DEFAULT 0,
  bloqueios     INT UNSIGNED NOT NULL DEFAULT 0,
  ultimo_403_em TIMESTAMP NULL DEFAULT NULL,
  desde         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalhe       VARCHAR(200) NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO coletor_saida (id, modo, detalhe) VALUES (1, 'direto', 'saindo pelo IP da própria VPS');
