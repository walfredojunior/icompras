# Como rodar o iCompras (guia rápido)

> Todos os comandos são executados na pasta raiz `C:\projetos\icompras`.

## Pré-requisitos (já instalados nesta máquina)
- Node.js 24, npm 11
- MariaDB 12.1 rodando na porta **3307** (serviço `MariaDB12.1`)
- Docker (para Meilisearch/Redis nas próximas fases)

## Primeira vez
```bash
npm install                 # instala tudo (uma vez)
npm run db:migrate          # cria as tabelas no banco
npm run db:seed             # insere planos e categorias iniciais
```

## Rodar no dia a dia
```bash
docker compose up -d        # liga Redis (fila) + Meilisearch (busca) — Docker Desktop aberto
npm run dev:web             # site em  http://localhost:3000  (redireciona para /es)
npm run dev:api             # API  em  http://localhost:3001  (teste: /health)
npm run dev:worker          # processa as listas de preço recebidas
npm run search:sync         # indexa os produtos na busca (rodar após ingerir preços)
```

### Páginas para ver
- Início:        http://localhost:3000/es
- Busca:         http://localhost:3000/es/search?q=ifone  (acha mesmo digitando errado)
- Produto:       http://localhost:3000/es/produto/apple-iphone-15  (lojas + filtro por cor)
- Criar conta:   http://localhost:3000/es/cadastro  (usuário: favoritos e alertas de preço)
- Painel loja:   http://localhost:3000/es/painel/cadastro  (chave de API, planos, assinatura)
- Painel ADMIN:  http://localhost:3000/es/admin/entrar  (banners e destaques — só você)
  - Login padrão: admin@icompras.local / admin123  (troque em ADMIN_EMAIL/ADMIN_PASSWORD no .env)

### Alimentar o catálogo com o scraper (comprasparaguai)
```bash
# 1) buscar produtos de uma categoria (número = quantos)
npm run seed:scrape -- celular 20
npm run seed:scrape -- perfume 20
npm run seed:scrape -- notebook 20
npm run seed:scrape -- eletronicos 20
npm run seed:scrape -- informatica 20

# 2) atualizar o site (impressões de IA + categorias + busca) — UMA vez, no fim
npm run catalogo:atualizar
```
Categorias válidas: `celular`, `perfume`, `notebook`, `informatica`, `eletronicos`.
Produtos sem oferta são pulados automaticamente. Pode rodar quantas vezes quiser (atualiza/não duplica).

### Alimentar o catálogo em massa (crawler do comprasparaguai)
```bash
# 1) testar sem gravar (mostra o que traria):
npm run scrape:crawl -- --dry celular

# 2) rodar uma vez:
npm run scrape:crawl -- celular      # só uma categoria
npm run scrape:crawl                 # todas as categorias

# 3) rodar POR DIAS, monitorando e atualizando o site sozinho (PowerShell):
$env:CRAWL_MONITOR='true'; npm.cmd run scrape:crawl
```
Categorias: `celular, notebook, informatica, eletronicos, perfume`.
O crawler pagina tudo, é educado (pausa 1,5s), é retomável (não repete o que já fez em 24h)
e no fim de cada categoria atualiza embeddings + categorias + busca sozinho.
Traz: produto + menor preço (US$) + nº real de lojas + **leads das lojas** (para você convidar).
Variáveis opcionais: `CRAWL_MAX_PAGES` (0=todas), `CRAWL_DELAY_MS`, `CRAWL_RECRAWL_HOURS`, `CRAWL_CYCLE_MIN`.

### Outros comandos de IA
```bash
npm run ai:embed      # gera as "impressões digitais" dos produtos
npm run ai:dedup      # agrupa produtos iguais escritos de formas diferentes
npm run ai:categorize # categoriza automaticamente os produtos
```

> Para só navegar nos dados que já existem, basta `docker compose up -d` + `npm run dev:web`.
> A API e o worker só precisam rodar quando for **receber** novas listas de preço.

> No Windows, se o `npm` for bloqueado, use `npm.cmd` no lugar de `npm`.

## Cadastrar uma loja de teste (gera uma chave de API)
```bash
npm run store:new -- "Nome da Loja"
```
Copie a chave exibida (só aparece uma vez) e envie a lista de preços:
```
POST http://localhost:3001/v1/price-list
Header:  Authorization: Bearer <sua-chave>
Body:    { "items": [ { "name": "iPhone 15", "brand": "Apple", "price": 5200000,
                        "attributes": { "color": "Preto", "storage": "128GB" } } ] }
```

Idiomas do site:
- Espanhol (padrão): http://localhost:3000/es
- Português:         http://localhost:3000/pt-BR
- Inglês:            http://localhost:3000/en

## Onde ficam as coisas
| Pasta | O que é |
|---|---|
| `apps/web`      | Site público (Next.js) |
| `apps/api`      | API que recebe listas de preço (Fastify) |
| `packages/db`   | Banco: schema (`migrations/`), conexão, seed |
| `packages/core` | Adaptadores configuráveis (IA, pagamento, notificação) |
| `.env`          | Senhas e configurações (NÃO compartilhar / não subir pro git) |

## Trocar provedores (só editar o `.env`)
- IA:          `AI_PROVIDER=claude`
- Pagamento:   `PAYMENT_PROVIDER=bancard`  (ou `pagopar`)
- Notificação: escolhido por canal (email / whatsapp) no código de alertas
