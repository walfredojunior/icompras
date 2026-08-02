-- Senha do administrador guardada no banco (criptografada), para poder ser
-- trocada pelo painel. Antes ela só existia no arquivo de configuração do
-- servidor, e trocar exigia editar o arquivo e reiniciar o site.
--
-- A tabela nasce VAZIA de propósito: enquanto não houver linha, o login segue
-- usando ADMIN_EMAIL/ADMIN_PASSWORD do .env (mesmo comportamento de hoje).
-- Assim ninguém fica trancado do lado de fora durante a atualização.
--
-- RECUPERAÇÃO: se a senha for esquecida, basta apagar a linha
--   DELETE FROM admin_user WHERE id = 1;
-- que o login volta a aceitar a senha do arquivo .env.
CREATE TABLE IF NOT EXISTS admin_user (
  id            TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  email         VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
