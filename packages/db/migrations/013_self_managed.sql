-- 013_self_managed.sql — loja-cliente que envia a própria lista (o scraper deve ignorá-la).

ALTER TABLE store ADD COLUMN self_managed TINYINT(1) NOT NULL DEFAULT 0;
