-- 001_init.sql — schema inicial do iCompras (MariaDB 12.1)
-- Modelo central: Produto (canônico) -> Variante (cor/tamanho) -> Oferta (loja + preço)

SET NAMES utf8mb4;

-- ===================== Lojas / empresas =====================
CREATE TABLE IF NOT EXISTS store (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(160) NOT NULL UNIQUE,
  name         VARCHAR(200) NOT NULL,
  email        VARCHAR(200) NULL,
  phone        VARCHAR(40) NULL,
  website      VARCHAR(300) NULL,
  logo_url     VARCHAR(500) NULL,
  country      CHAR(2) NOT NULL DEFAULT 'PY',
  source       ENUM('api','scraped') NOT NULL DEFAULT 'api',
  external_url VARCHAR(500) NULL,
  status       ENUM('active','inactive','pending') NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store_source (source),
  INDEX idx_store_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== Planos e assinaturas =====================
CREATE TABLE IF NOT EXISTS plan (
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug                     VARCHAR(80) NOT NULL UNIQUE,
  name                     VARCHAR(120) NOT NULL,
  price_monthly            DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency                 CHAR(3) NOT NULL DEFAULT 'PYG',
  max_products             INT NOT NULL DEFAULT 0,   -- 0 = ilimitado
  max_api_requests_per_day INT NOT NULL DEFAULT 0,   -- 0 = ilimitado
  features                 JSON NULL,
  active                   TINYINT(1) NOT NULL DEFAULT 1,
  created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscription (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id                BIGINT UNSIGNED NOT NULL,
  plan_id                 BIGINT UNSIGNED NOT NULL,
  status                  ENUM('trialing','active','past_due','canceled') NOT NULL DEFAULT 'trialing',
  gateway                 ENUM('bancard','pagopar') NULL,
  gateway_subscription_id VARCHAR(200) NULL,
  current_period_start    DATETIME NULL,
  current_period_end      DATETIME NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sub_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
  CONSTRAINT fk_sub_plan  FOREIGN KEY (plan_id)  REFERENCES plan(id),
  INDEX idx_sub_store (store_id),
  INDEX idx_sub_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== Chaves de API (por loja) =====================
CREATE TABLE IF NOT EXISTS api_key (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id     BIGINT UNSIGNED NOT NULL,
  key_prefix   VARCHAR(16) NOT NULL,   -- parte visível para identificação
  key_hash     CHAR(64) NOT NULL,      -- SHA-256 do segredo (nunca guardamos o segredo cru)
  label        VARCHAR(120) NULL,
  last_used_at DATETIME NULL,
  revoked      TINYINT(1) NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_key_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE CASCADE,
  UNIQUE KEY uq_key_hash (key_hash),
  INDEX idx_key_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== Categorias (com traduções pt-BR/es/en) =====================
CREATE TABLE IF NOT EXISTS category (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parent_id  BIGINT UNSIGNED NULL,
  slug       VARCHAR(160) NOT NULL UNIQUE,
  position   INT NOT NULL DEFAULT 0,
  icon       VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES category(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS category_translation (
  category_id BIGINT UNSIGNED NOT NULL,
  locale      VARCHAR(5) NOT NULL,   -- pt-BR, es, en
  name        VARCHAR(200) NOT NULL,
  PRIMARY KEY (category_id, locale),
  CONSTRAINT fk_cattr_cat FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== Produtos canônicos =====================
CREATE TABLE IF NOT EXISTS product (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug              VARCHAR(200) NOT NULL UNIQUE,
  category_id       BIGINT UNSIGNED NULL,
  brand             VARCHAR(120) NULL,
  canonical_name    VARCHAR(300) NOT NULL,
  description       TEXT NULL,
  primary_image_url VARCHAR(500) NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_prod_cat FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE SET NULL,
  INDEX idx_prod_cat (category_id),
  INDEX idx_prod_brand (brand),
  FULLTEXT KEY ft_prod_name (canonical_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Embeddings para similaridade/agrupamento por IA (tipo VECTOR nativo do MariaDB 12).
-- Tabela separada para permitir que só produtos já processados tenham vetor (índice exige NOT NULL).
CREATE TABLE IF NOT EXISTS product_embedding (
  product_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  embedding  VECTOR(1024) NOT NULL,
  model      VARCHAR(80) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  VECTOR INDEX (embedding),
  CONSTRAINT fk_emb_prod FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== Variantes e atributos =====================
CREATE TABLE IF NOT EXISTS product_variant (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  title      VARCHAR(300) NULL,
  image_url  VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_var_prod FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE,
  INDEX idx_var_prod (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Atributos da variante (ex.: color=preto, storage=128gb) — habilita o filtro "por cor".
CREATE TABLE IF NOT EXISTS variant_attribute (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  variant_id  BIGINT UNSIGNED NOT NULL,
  attr_key    VARCHAR(60) NOT NULL,    -- color, storage, size...
  value_slug  VARCHAR(120) NOT NULL,   -- preto, 128gb
  value_label VARCHAR(160) NOT NULL,   -- "Preto", "128 GB"
  CONSTRAINT fk_vattr_var FOREIGN KEY (variant_id) REFERENCES product_variant(id) ON DELETE CASCADE,
  INDEX idx_vattr_lookup (attr_key, value_slug),
  INDEX idx_vattr_var (variant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== Ofertas (loja + preço por variante) =====================
CREATE TABLE IF NOT EXISTS offer (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  variant_id   BIGINT UNSIGNED NOT NULL,
  store_id     BIGINT UNSIGNED NOT NULL,
  price        DECIMAL(14,2) NOT NULL,
  currency     CHAR(3) NOT NULL DEFAULT 'PYG',
  url          VARCHAR(600) NULL,
  image_url    VARCHAR(500) NULL,
  in_stock     TINYINT(1) NOT NULL DEFAULT 1,
  source       ENUM('api','scraped') NOT NULL DEFAULT 'api',
  external_id  VARCHAR(200) NULL,   -- id do produto no sistema da loja
  last_seen_at DATETIME NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_offer_var   FOREIGN KEY (variant_id) REFERENCES product_variant(id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_store FOREIGN KEY (store_id)   REFERENCES store(id) ON DELETE CASCADE,
  UNIQUE KEY uq_offer_store_ext (store_id, external_id),
  INDEX idx_offer_variant (variant_id),
  INDEX idx_offer_store (store_id),
  INDEX idx_offer_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Histórico de preço (base para alertas de queda e gráficos).
CREATE TABLE IF NOT EXISTS offer_price_history (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  offer_id    BIGINT UNSIGNED NOT NULL,
  price       DECIMAL(14,2) NOT NULL,
  currency    CHAR(3) NOT NULL DEFAULT 'PYG',
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hist_offer FOREIGN KEY (offer_id) REFERENCES offer(id) ON DELETE CASCADE,
  INDEX idx_hist_offer (offer_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===================== Usuários finais, favoritos e alertas =====================
CREATE TABLE IF NOT EXISTS app_user (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  name          VARCHAR(160) NULL,
  locale        VARCHAR(5) NOT NULL DEFAULT 'es',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favorite (
  user_id    BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id)    REFERENCES app_user(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_prod FOREIGN KEY (product_id) REFERENCES product(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS price_alert (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id          BIGINT UNSIGNED NOT NULL,
  product_id       BIGINT UNSIGNED NOT NULL,
  variant_id       BIGINT UNSIGNED NULL,   -- NULL = qualquer variante do produto
  target_price     DECIMAL(14,2) NOT NULL,
  currency         CHAR(3) NOT NULL DEFAULT 'PYG',
  channel          ENUM('email','whatsapp') NOT NULL DEFAULT 'email',
  active           TINYINT(1) NOT NULL DEFAULT 1,
  last_notified_at DATETIME NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alert_user FOREIGN KEY (user_id)    REFERENCES app_user(id)       ON DELETE CASCADE,
  CONSTRAINT fk_alert_prod FOREIGN KEY (product_id) REFERENCES product(id)        ON DELETE CASCADE,
  CONSTRAINT fk_alert_var  FOREIGN KEY (variant_id) REFERENCES product_variant(id) ON DELETE CASCADE,
  INDEX idx_alert_user (user_id),
  INDEX idx_alert_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
