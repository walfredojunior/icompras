-- O QUE A FONTE DECLAROU PARA CADA PRODUTO — guardado, não só contado.
--
-- ⚠ POR QUE ISTO EXISTE (17/08/2026). A recuperação de 16/08 visitou 132.367
-- páginas e CONTOU o que encontrou: "5.960 produtos a fonte chama de Diversos,
-- 8.619 não declaram nada". Números certos e inúteis — **não deu para saber
-- QUAIS produtos eram**, porque nada foi gravado por produto. Para decidir o
-- destino desses 14 mil seria preciso visitar as 26 mil páginas de novo, só
-- para redescobrir o que já tinha sido descoberto.
--
-- É a mesma lição do categorizador por IA de 15/08, escrita de outro jeito:
-- processo em massa que não deixa rastro por registro obriga a refazer tudo.
--
-- ====================================================================
-- POR QUE UMA TABELA SEPARADA, E NÃO DUAS COLUNAS EM `product`
-- ====================================================================
-- Tentei as colunas em `product` primeiro. O MariaDB recusou as duas formas
-- que não prejudicariam o site:
--
--   ALGORITHM=INSTANT → "not supported for this operation"
--   LOCK=NONE         → "Fulltext index creation requires a lock. Try LOCK=SHARED"
--
-- A causa é o índice de texto completo `ft_prod_name`, que a busca usa: tabela
-- com FULLTEXT não aceita coluna nova sem reconstruir, e reconstruir exige
-- trava. Aceitar `LOCK=SHARED` seria parar a escrita em `product` — a tabela
-- mais movimentada do sistema — com gente usando o site. Tabela nova nasce
-- vazia, não tem nada para reconstruir e não trava nada.
--
-- Sem chave estrangeira para `product` de propósito: criá-la pediria uma trava
-- momentânea em `product`, e em 07/08/2026 uma transação esquecida segurou
-- essa tabela por 3h52. Sobrar linha de produto apagado aqui é inofensivo —
-- isto é registro de observação, não dado do produto.
--
-- COMO LER:
--   sem linha aqui                  → nunca fomos olhar a página dele
--   linha com `declarada` NULL      → olhamos, e a fonte não declara categoria
--   declarada = 'diversos'          → a gaveta de bagunça da própria fonte
--                                     (a trilha da página dela diz
--                                      "Início › Categorias › Diversos")
--   declarada = 'cosmetico'         → declarou isso
--
-- ⚠ `declarada` guarda o que a FONTE DISSE, não o que nós decidimos. Se um dia
-- a categoria do produto for corrigida à mão ou por IA, esta linha continua
-- dizendo o que a fonte declarava — é registro, não decisão.
CREATE TABLE IF NOT EXISTS produto_categoria_fonte (
  product_id   BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  -- NULL é um valor legítimo: "a página abriu e não declara categoria".
  declarada    VARCHAR(80) NULL,
  conferida_em DATETIME    NOT NULL,
  KEY idx_declarada (declarada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
