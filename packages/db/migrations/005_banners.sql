-- 005_banners.sql — banners e produtos em destaque (gerenciados pelo admin).

CREATE TABLE IF NOT EXISTS banner (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NULL,
  image_url     VARCHAR(500) NOT NULL,
  link_url      VARCHAR(600) NULL,
  placement     VARCHAR(60) NOT NULL DEFAULT 'home_hero', -- home_hero | category
  category_slug VARCHAR(160) NULL,                        -- usado quando placement = category
  store_id      BIGINT UNSIGNED NULL,                     -- publicidade paga (loja atribuída)
  is_paid       TINYINT(1) NOT NULL DEFAULT 0,
  position      INT NOT NULL DEFAULT 0,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  starts_at     DATETIME NULL,
  ends_at       DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_banner_store FOREIGN KEY (store_id) REFERENCES store(id) ON DELETE SET NULL,
  INDEX idx_banner_placement (placement, active),
  INDEX idx_banner_category (category_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS featured_product (
  product_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feat_prod FOREIGN KEY (product_id) REFERENCES product(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
