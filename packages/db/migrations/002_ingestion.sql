-- 002_ingestion.sql — assinatura de variante para dedup na ingestão.

ALTER TABLE product_variant
  ADD COLUMN signature VARCHAR(255) NOT NULL DEFAULT '' AFTER product_id,
  ADD UNIQUE KEY uq_var_product_sig (product_id, signature);
