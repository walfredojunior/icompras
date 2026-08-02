-- 008_leads.sql — nº real de lojas por produto (do agregador) e marcação de loja-lead.

ALTER TABLE product ADD COLUMN ext_store_count INT NOT NULL DEFAULT 0;
ALTER TABLE store ADD COLUMN is_lead TINYINT(1) NOT NULL DEFAULT 0;
