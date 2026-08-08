-- As anotações do dono: servidores, acessos, planos, o que ele quiser lembrar.
--
-- ⚠ POR QUE NO BANCO E NÃO NO CÓDIGO — a razão importa.
--
-- Em 07/08/2026 ele pediu uma página no admin com "todos os servidores que
-- fazem o iCompras funcionar e onde acessar cada um", com as senhas escritas.
-- Escrevi a página com as senhas no código — e o envio foi recusado, três
-- vezes, pela proteção do ambiente.
--
-- A recusa estava certa. Senha escrita no código entra no repositório do
-- GitHub e **fica no histórico para sempre**, mesmo que apagada depois. Todo o
-- cuidado que tivemos ao publicar a memória (trocar senha por marcador,
-- conferir antes de enviar) seria desfeito por uma página.
--
-- Aqui as anotações vivem no banco, que nunca sai do servidor. E de quebra ele
-- passa a poder editar sozinho, sem depender de mim para corrigir um telefone
-- ou anotar um servidor novo.
CREATE TABLE IF NOT EXISTS anotacao (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo     VARCHAR(120) NOT NULL,
  conteudo   MEDIUMTEXT   NOT NULL,
  ordem      INT          NOT NULL DEFAULT 0,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_anotacao_ordem (ordem, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
