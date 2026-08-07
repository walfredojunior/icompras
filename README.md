# iCompras

Comparador de preços do Paraguai para brasileiros. No ar em **https://icompras.com.py**.

O visitante procura um produto e vê, numa tela só, quais lojas paraguaias vendem
e por quanto — em dólar, real e guarani. Os preços são coletados sozinhos, várias
vezes ao dia.

## O que tem dentro

| Pasta | O que é |
|---|---|
| `apps/web` | O site (Next.js 16, App Router) |
| `apps/api` | A API que as lojas usam para enviar produtos (Fastify) |
| `apps/worker` | Os robôs coletores, o guardião e as tarefas de fundo |
| `packages/core` | Regras compartilhadas: imagens, busca, notificações |
| `packages/db` | Conexão com o banco |
| `packages/db/migrations` | Alterações do banco, em ordem |

## Como isso funciona, em uma passada

**Quatro robôs coletores** rodam sem parar, cada um com um papel:

- dois fazem a **volta normal** pelo catálogo inteiro;
- um cuida dos **produtos quentes** — os que mudam de preço com frequência;
- um procura **produtos novos**.

Um **guardião** vigia todos eles a cada 5 minutos: religa o que travar, encerra
transação que esteja bloqueando o banco e registra o que viu.

As lojas também podem **enviar o próprio catálogo** pela API, no mesmo formato do
Compras Paraguai — o manual fica em `/api/schema/swagger-ui/`.

## Rodando na sua máquina

```bash
cp .env.example .env     # e preencha os valores
npm install
npm run dev -w @icompras/web
```

Precisa de MariaDB 11+, Redis e Meilisearch. O passo a passo está em
`docs/COMO-RODAR.md`.

> ⚠️ **Nunca aponte o coletor para o banco local.** Ele foi feito para rodar no
> servidor de produção, que é a fonte da verdade.

## Comentários no código

Este projeto comenta o **porquê**, não o *o quê*. Boa parte dos comentários
guarda um defeito real que já aconteceu em produção e a medição que levou à
solução — por exemplo, por que a busca de produtos relacionados compara só
dentro da mesma categoria (`apps/web/src/lib/products.ts`), ou por que a
classificação de prioridade não pode ser dividida em blocos
(`apps/worker/src/prioridade.ts`).

Vale ler antes de mexer: quase todos existem porque alguém já tentou o caminho
mais óbvio e ele não funcionou.

## Licença

Projeto privado. Todos os direitos reservados.
