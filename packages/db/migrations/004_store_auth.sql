-- 004_store_auth.sql — senha para o login do painel da loja.

ALTER TABLE store
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER email;
