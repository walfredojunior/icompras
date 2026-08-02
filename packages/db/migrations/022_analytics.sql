-- Medição de audiência do site.
--
-- PRIVACIDADE: guardamos apenas CONTAGENS AGREGADAS por dia. Nenhum endereço
-- de IP, nenhum identificador de pessoa. O país vem do cabeçalho CF-IPCountry
-- que a Cloudflare já envia junto com cada requisição.

-- Visitas por dia, hora, país e tipo de aparelho.
-- A hora entra na chave para dar o gráfico de horários de pico — são no
-- máximo 24 linhas por dia/país/aparelho, não pesa.
CREATE TABLE IF NOT EXISTS analytics_daily (
  day     DATE            NOT NULL,
  hour    TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- 0..23
  country CHAR(2)         NOT NULL DEFAULT 'XX', -- BR, PY, AR… XX = desconhecido
  device  VARCHAR(10)     NOT NULL DEFAULT 'other', -- mobile | desktop | other
  views   INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (day, hour, country, device)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Páginas mais vistas, separadas por tipo.
CREATE TABLE IF NOT EXISTS analytics_page (
  day   DATE         NOT NULL,
  kind  VARCHAR(16)  NOT NULL,   -- produto | categoria | loja | busca | home
  slug  VARCHAR(200) NOT NULL,
  views INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, slug),
  INDEX idx_apage_kind (kind, day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- O que as pessoas buscam — e quantos resultados receberam.
-- Termo com last_results = 0 é buraco de catálogo: gente procurando o que
-- ainda não temos.
CREATE TABLE IF NOT EXISTS analytics_search (
  day          DATE         NOT NULL,
  term         VARCHAR(160) NOT NULL,
  searches     INT          NOT NULL DEFAULT 0,
  last_results INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (day, term),
  INDEX idx_asearch_vazias (day, last_results)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cliques que o iCompras ENVIOU para cada loja. É o número que prova o valor
-- do serviço na hora de vender o plano mensal.
CREATE TABLE IF NOT EXISTS analytics_store_click (
  day      DATE            NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  target   VARCHAR(12)     NOT NULL DEFAULT 'site', -- site | whatsapp
  clicks   INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (day, store_id, target),
  CONSTRAINT fk_aclick_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
