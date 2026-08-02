# iCompras — Plano do Projeto

> Comparador de preços (estilo PriceRunner) para o mercado do Paraguai, com camada de IA
> para organização de catálogo, painel B2B para lojas com planos mensais, API de ingestão
> de listas de preço, e um módulo de seed/scraper para popular o catálogo inicial.
>
> Documento vivo — atualizado conforme as decisões. Última revisão: 2026-07-27.

---

## 1. Visão geral

O produto reúne **três frentes** numa só plataforma:

1. **Vitrine pública** — comparação de preços, indexável (SEO é a principal fonte de tráfego).
2. **Painel B2B (lojas)** — cadastro da empresa, escolha de plano mensal, chave de API, envio de listas de preço.
3. **Camada de IA** — organiza categorias, agrupa produtos iguais de lojas diferentes, extrai
   atributos (cor, tamanho), e sustenta a busca tolerante a erro de digitação.

Público duplo: qualquer pessoa navega sem login; usuários cadastrados ganham **favoritos** e
**alertas de queda de preço**.

Idiomas: **pt-BR, es, en**. Traduzir 100% da interface e da taxonomia (categorias); **nome do
produto fica no idioma original** (a busca e a IA lidam com isso).

---

## 2. Stack definida

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend + SSR/SEO | **Next.js (App Router) + TypeScript** | SSR/ISR para SEO, `next/image`, ecossistema único |
| i18n | **next-intl** (pt-BR / es / en) | Detecção automática + traduções de UI e categorias |
| UI | **Tailwind + shadcn/ui** | Design system limpo estilo PriceRunner (claro/escuro) |
| API de ingestão | **Fastify + fila BullMQ/Redis** | Recebe listas de preço async, aguenta picos |
| Banco (fonte da verdade) | **MariaDB 12.1** (porta 3307) | Já instalado; tipo `VECTOR` nativo (testado) |
| Busca | **Meilisearch** | Tolerância a erro de digitação nativa (iphone/ifone/ipone) |
| Imagens | **sharp** → **S3/Cloudflare R2** → CDN | Otimiza no upload (AVIF/WebP, múltiplos tamanhos) |
| Camada de IA | **Adaptador configurável** (Claude padrão) | Troca de provedor por config |
| Pagamentos | **Adaptador configurável: Bancard + Pagopar** | Mercado Paraguai (PYG), Pix/cartão |
| Notificações | **Adaptador: e-mail + WhatsApp** | WhatsApp é canal dominante no PY |
| Seed/Scraper | **Crawler estruturado + PixelRAG** | Popular catálogo inicial e estudar referências |

**Princípio de arquitetura:** IA, pagamento e notificação são **adaptadores** atrás de uma
interface única. Trocar de provedor é mudar configuração, não reescrever código.

---

## 3. Modelo de dados (núcleo)

Separação que resolve o caso "clico no produto → vejo lojas → clico na cor → vejo lojas com aquela cor":

```
Produto (canônico)            ← criado/agrupado pela IA (dedup por embedding + LLM)
 └─ Variante (cor, tamanho, etc.)
     └─ Oferta (loja, preço, estoque, link)
```

- Clico no **produto** → todas as lojas agrupadas por variante.
- Clico na **cor** → filtro as ofertas daquela variante.
- A IA descobre que "iPhone 15 Preto" (Loja A) e "iPhone 15 Black" (Loja B) são a **mesma variante**.

Entidades principais: `empresa/loja`, `plano`, `assinatura`, `usuario`, `alerta_preco`,
`produto`, `variante`, `oferta`, `categoria`, `fonte` (`api` | `scraped`), `chave_api`.

Embeddings guardados em coluna `VECTOR` do MariaDB (índice HNSW, `VEC_DISTANCE_COSINE`).

---

## 4. Ingestão de preços

- Cada loja recebe uma **chave de API**; envia sua lista de preço (JSON/CSV) para a API.
- A API valida, enfileira (BullMQ) e processa de forma assíncrona.
- Rate-limit por chave, conforme o **plano** contratado.
- **Mesma pipeline** para dados de API e para dados do seed/scraper (só muda `fonte`).

---

## 5. Busca tolerante a erro

- **Meilisearch** com typo tolerance nativa → resolve iphone / ifone / ipone.
- Facetas: categoria, cor, faixa de preço, loja.
- Suporte multilíngue de UI; conteúdo de produto no idioma original.

---

## 6. Camada de IA (configurável)

Interface única (`agente.categorizar()`, `agente.extrairAtributos()`, `agente.acharSimilares()`);
config escolhe o provedor. Padrão: **Claude** (modelo por tarefa — mais barato para volume,
mais forte para casos difíceis).

- **Embeddings + VECTOR** → agrupamento/similaridade/dedup de produtos (barato, em massa).
- **LLM** → categorização, normalização e extração de atributos das listas cruas.

---

## 7. Imagens rápidas

- No upload: `sharp` redimensiona, corta, converte para **AVIF/WebP**, gera 3–4 tamanhos.
- Armazena em **R2/S3** e serve via **CDN**; no front, `next/image` entrega o tamanho certo.

---

## 8. Seed / Scraper (catálogo inicial)

Objetivo: popular o catálogo **antes de ter clientes**, e servir de funil de vendas.

| Tarefa | Ferramenta |
|---|---|
| Semear catálogo do comprasparaguai (volume) | **Crawler estruturado** (Playwright/Firecrawl) + extração via LLM |
| Estudar PriceRunner / páginas difíceis | **PixelRAG** (plugin `pixelbrowse`, comando `pixelshot`) |
| Fallback quando o HTML falha | **PixelRAG** como plano B |

- Lojas raspadas entram com `fonte = scraped` e passam pela **mesma pipeline** de ingestão.
- Quando chega cliente real: desliga a fonte raspada ou substitui pelos dados oficiais.

**Cuidados (fonte: comprasparaguai.com.br):**
- `robots.txt` permite rastrear (só bloqueia caminhos de anúncio). Sinal `ai-train=no` — não
  usar conteúdo para treinar modelo (não é nosso caso).
- **Fato (preço/nome) não tem copyright; descrição e foto têm.** Re-hospedar fotos com cautela;
  substituir por foto oficial da loja assim que possível.
- Rate-limit educado + cache; ler os **Termos de Uso** antes de produção.
- **Lojas raspadas = primeira lista de leads de vendas.**

---

## 9. Pagamentos e planos

- Cobrança recorrente mensal via **adaptador**: `BancardProvider` e `PagoparProvider` (PYG).
- Config escolhe o gateway ativo.
- Limites por plano (nº de produtos, requisições de API, etc.).

---

## 10. Contas de usuário e alertas

- Auth (Auth.js) para usuários finais.
- **Favoritos** e **alertas de queda de preço**: usuário salva produto/variante + preço-alvo;
  a cada ingestão, um job compara e notifica por **e-mail** e/ou **WhatsApp** (adaptador).

---

## 11. Roadmap por fases

0. **Fundação** — monorepo, MariaDB + schema, design system, auth (lojas + usuários), i18n.
1. **Ingestão** — API de listas + fila + otimização de imagem + rate-limit por plano.
2. **IA** — dedup/agrupamento, extração de atributos, categorização automática.
3. **Busca** — Meilisearch com typo tolerance + facetas.
4. **Vitrine** — página de produto com variantes/cores + comparação, SSR/SEO.
5. **Contas + alertas** — favoritos, alertas, notificação e-mail/WhatsApp.
6. **Seed/Scraper** — crawler do comprasparaguai + PixelRAG.
7. **Monetização** — planos, Bancard/Pagopar, limites, faturas.
8. **Escala** — cache, CDN, observabilidade, admin.

---

## 12. Ambiente

### Local (desenvolvimento — já disponível)
- **MariaDB 12.1** — serviço `MariaDB12.1`, porta **3307**.
  - Banco: `icompras` (utf8mb4 / utf8mb4_uca1400_ai_ci).
  - Usuário da aplicação: `icompras_app` @ `127.0.0.1` / `localhost`.
  - **A senha fica no `.env` (não versionar).**
- Meilisearch e Redis: subir localmente (Docker) na Fase 0/1.

### Produção (futuro)
- **VPS a contratar** (ainda não necessária — só no deploy).
  - Sugestão: **4+ vCPU, 8–16 GB RAM, SSD NVMe**, Ubuntu 22.04/24.04.
  - Considerar CDN (Cloudflare) para imagens.
- Antes de produção: avaliar fixar o MariaDB numa versão **LTS** (12.1 é rolling, suporte mais curto).

---

## 13. Decisões registradas

- ✅ Banco: **MariaDB 12.1**, porta **3307** (mantida; sem conflito com o 11.5 na 3306).
- ✅ Idiomas: **pt-BR / es / en** (UI + categorias; produto no idioma original).
- ✅ Escopo: **plataforma completa**, visual clean tipo PriceRunner.
- ✅ Público: **vitrine pública + contas de usuário** (alertas de preço).
- ✅ Pagamentos: **Bancard + Pagopar**, configuráveis (PYG).
- ✅ Seed via scraper do **comprasparaguai.com.br** + **PixelRAG** para estudo/fallback.
- ✅ VPS: será contratada mais tarde; desenvolvimento é local.

---

## 14. Estado atual

**Fase 0 — Fundação: CONCLUÍDA ✅** (testada de ponta a ponta)

Estrutura criada (monorepo npm workspaces):

```
icompras/
  package.json            (workspaces: packages/*, apps/*)
  .env / .env.example     (config: banco, IA, pagamento, etc.)
  docs/PLANO.md, COMO-RODAR.md
  packages/
    db/                   MariaDB: pool + migrations + seed (16 tabelas + VECTOR)
    core/                 adaptadores configuráveis: ai / payment / notification
  apps/
    api/                  Fastify — /health conecta no banco (OK)
    web/                  Next.js 16 + Tailwind + next-intl (pt-BR/es/en) — landing OK
```

Verificado:
- Banco `icompras` com 16 tabelas, coluna `VECTOR` e índice HNSW funcionando.
- Seed: 4 planos + 7 categorias em 3 idiomas.
- API sobe e responde `{"status":"ok","db":true}`.
- Site sobe e serve `/es`, `/pt-BR`, `/en` com conteúdo traduzido.

**Fase 1 — Ingestão: CONCLUÍDA ✅** (testada de ponta a ponta)

Adicionado:
```
docker-compose.yml       Redis (fila) + Meilisearch (busca, para Fase 3)
packages/queue/          BullMQ + Redis (fila price-list)
packages/core/           + auth (chave de API), ingestão (schema zod),
                           storage (local), media (sharp: WebP/AVIF)
apps/api/                + auth por chave + POST /v1/price-list + script create-store
apps/worker/             consome a fila e grava produto/variante/oferta/histórico
```

Verificado (teste real):
- Loja + chave de API criadas; `POST /v1/price-list` autentica e enfileira (202).
- Worker processou 4 itens → agrupou corretamente em **2 produtos, 4 variantes, 4 ofertas,
  6 atributos, 4 registros de histórico** (iPhone virou 1 produto com 3 variantes de cor/memória).
- sharp gerou 6 versões otimizadas (WebP+AVIF, 3 tamanhos).

Comandos novos: `npm run dev:worker`, `npm run store:new -- "Nome da Loja"`.
Requer Docker (Redis): `docker compose up -d redis`.

Nota técnica (dívida menor): dedup de produto na Fase 1 é ingênuo (por slug de marca+nome).
A Fase 2 (IA) substitui por embeddings/LLM para agrupar produtos iguais escritos de formas diferentes.

**Fases 3 e 4 — Busca + Vitrine: CONCLUÍDAS ✅** (testadas de ponta a ponta)

Adicionado:
```
packages/search/         Meilisearch: índice de produtos + sync (npm run search:sync)
apps/web/                busca (/search) + página de produto (/produto/[slug])
                         com filtro por cor e tabela de comparação de ofertas.
                         Lê MariaDB e Meilisearch direto (libs próprias em src/lib).
```

Verificado (teste real):
- Busca tolerante a erro: "iphone", "ifone", "ipone", "iphon", "apple" → todos acham o iPhone 15.
  (typoTolerance ajustada: 1 erro a partir de 4 letras, 2 a partir de 5.)
- Página do produto mostra 2 lojas (Loja Demo/Loja Dos), cores Preto/Azul/Verde, menor preço
  destacado ("Más barato") e botão "Ver oferta".

Comando novo: `npm run search:sync` (indexa/reindexa os produtos). Requer Meilisearch:
`docker compose up -d meilisearch`.

Nota técnica: o site NÃO importa os pacotes internos `@icompras/*` (Turbopack/Next 16 tem
atrito para resolver TS de workspace); usa `mariadb` e `meilisearch` diretamente em `apps/web/src/lib`.
Aviso menor do Next 16: `middleware` renomeado para `proxy` (funciona, só deprecação).

**Fase 2 — IA (agrupamento por similaridade): CONCLUÍDA ✅** (testada de ponta a ponta)

Adicionado:
```
packages/core/embedding/  provedor de embeddings CONFIGURÁVEL:
                          - "local" (padrão): n-gramas hasheados, SEM chave, offline, grátis
                          - "voyage"/"openai": stubs (precisam de EMBEDDING_API_KEY)
apps/worker/scripts/      embed.ts  (gera vetores -> coluna VECTOR do MariaDB)
                          dedup.ts  (mescla produtos iguais via VEC_DISTANCE_COSINE)
```

Verificado (teste real): uma loja enviou "iPhone15" (sem espaço) → virou produto separado.
- `ai:embed` gerou os vetores; distância iPhone 15 ↔ iPhone15 = **0.148** (vs ~0.75-0.83 p/ notebook).
- `ai:dedup` (limiar 0.35) **mesclou** os dois num só produto, movendo a oferta para a variante
  correta. Resultado: a variante Preto/128GB passou a comparar **3 lojas**.

Comandos novos: `npm run ai:embed`, `npm run ai:dedup`. Config em `.env`:
`EMBEDDING_PROVIDER=local`, `DEDUP_THRESHOLD=0.35`.

Nota: o provedor local resolve variações lexicais (typos, espaçamento, ordem). Para similaridade
semântica mais profunda (sinônimos, línguas diferentes), trocar para Voyage/OpenAI quando houver chave.

**Fase 5 — Contas de usuário + alertas de preço: CONCLUÍDA ✅** (testada de ponta a ponta)

Adicionado:
```
packages/db/003          tabela notification_log
packages/core/notification  provedor "log" (dev, não envia) + stubs email/whatsapp reais
apps/worker/ingest.ts    motor de alertas: na ingestão, se preço <= alvo, notifica + registra
apps/web/                auth próprio (scrypt + cookie assinado HMAC): /api/auth/{register,login,logout}
                         páginas /entrar /cadastro /alertas; form de alerta na página de produto;
                         cabeçalho com estado logado.
```

Verificado (teste real):
- Preço caiu para ₲4.900.000 (alvo ₲4.950.000) → worker disparou `[NOTIFY:email]` + gravou em
  notification_log.
- Cadastro → login → criar alerta → página "Meus alertas" mostra o alerta. Cabeçalho reflete login.

Config: `EMAIL_PROVIDER=log`, `WHATSAPP_PROVIDER=log`, `AUTH_SECRET` (no `.env` e em `apps/web/.env.local`).
Nota: envio real de e-mail/WhatsApp pluga depois (precisa de credenciais SMTP/Resend/SES ou WhatsApp Cloud API).
Auth: implementação própria e simples (adequada para MVP); revisar antes de produção.

**Painel B2B (lojas) + assinatura: CONCLUÍDO ✅** (testado de ponta a ponta)

Adicionado:
```
packages/db/004          store.password_hash (login do painel)
packages/core/payment    provedor "manual" (dev, ativa direto) além de bancard/pagopar (stubs)
apps/web/                auth de loja (cookie próprio icompras_store) em src/lib/storeauth.ts
                         /api/store/{register,login,logout,apikey,subscribe}
                         páginas /painel, /painel/entrar, /painel/cadastro
                         (gerar chave de API, escolher e assinar plano, ver ofertas)
```

Verificado (teste real): loja se cadastrou → gerou a própria chave → assinou o plano Básico
(ativo no banco) → usou a chave para enviar um preço (Samsung Galaxy S24 cadastrado). Painel
mostra plano e chave.

Config: `PAYMENT_PROVIDER=manual` (dev). Bancard/Pagopar reais precisam de credenciais + fluxo
de checkout/webhook (a integrar quando houver conta).

**Categorização por IA + Seed/Scraper: CONCLUÍDOS ✅** (testados de ponta a ponta)

Adicionado:
```
packages/core/categorize   categorizador local (sementes por categoria + embeddings), configurável
apps/worker/scripts/categorize.ts   npm run ai:categorize
apps/worker/scripts/scrape.ts       npm run seed:scrape -- <categoria> <limite>
```

Verificado (teste real):
- Categorização: Redmi Note 13→celulares, Notebook IdeaPad→informatica, Perfume→beleza.
- Scraper: buscou 4 celulares reais do comprasparaguai (iPhone 17 Pro Max/Pro, 16 Pro Max,
  Xiaomi Redmi 14C) com preço em USD; as fotos foram baixadas e OTIMIZADAS (WebP/AVIF, 2-7 KB);
  entraram com source='scraped' pela mesma pipeline; aparecem na busca por "iphone".

Notas: o scraper filtra produtos da categoria pelo prefixo do slug (ex.: /celular-...), é educado
(pausa 1,5s, User-Agent próprio). Seed traz nome + menor preço + imagem (1 oferta por produto na
loja "Catálogo (seed)"); ofertas por loja individual não são raspadas. Dado temporário; lojas
raspadas viram leads de venda.

**Painel de Administrador + Banners: CONCLUÍDO ✅** (testado de ponta a ponta)

Adicionado:
```
packages/db/005          tabelas banner + featured_product
apps/web/src/lib/adminauth.ts   login de admin (cookie icompras_admin, credenciais no .env)
apps/web/api/admin/{login,logout,banners,banners/[id],featured,featured/[id],products,upload}
apps/web/[locale]/admin, /admin/entrar   painel: criar/ativar/excluir banners, destacar produtos
apps/web/components: BannerManager, FeaturedManager, BannerCarousel, AdminMenu
```
Banners: topo da home (carrossel), por categoria, e publicidade paga (loja atribuída + flag is_paid).
Upload de imagem com sharp (otimiza p/ WebP). Exibição: carrossel na home, banner no topo da
categoria (busca), e seção "Destaques" na home. Admin: `/admin/entrar` (ADMIN_EMAIL/ADMIN_PASSWORD no .env).

### Estado do projeto: MVP funcional em todas as frentes principais ✅
Falta para produção: integração real Bancard/Pagopar (credenciais), envio real de e-mail/WhatsApp
(credenciais), reforço de segurança do auth, deploy na VPS, e refino do scraper por categoria.
