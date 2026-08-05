import { z } from "zod";
import { ItemCompatSchema } from "./compat.js";

// DOCUMENTAÇÃO GERADA DO CÓDIGO — não escrita à mão.
//
// O corpo dos endpoints sai de `z.toJSONSchema(ItemCompatSchema)`, ou seja: do
// MESMO esquema que valida os dados de verdade. Mexer no contrato atualiza a
// documentação no mesmo commit, sem ninguém lembrar de nada.
//
// Existe uma página escrita à mão em /admin/api que já mentiu no passado por
// esse motivo; esta não tem como.
//
// OpenAPI 3.1 de propósito: é a versão que usa o mesmo dialeto de JSON Schema
// que o zod gera (2020-12). Em 3.0 os esquemas precisariam ser adaptados.

const ItemJson = z.toJSONSchema(ItemCompatSchema, { io: "input" });

const SaidaProduto = {
  type: "object",
  properties: {
    id: { type: "integer", example: 12345, description: "Id do produto no iCompras." },
    code: { type: "string", example: "AP0700017R", description: "O `code` que a loja enviou." },
    name: { type: "string", example: "Celular Apple iPhone 16 Pro 128GB" },
    price: { type: "number", example: 929.0, description: "Preço enviado pela loja." },
    price_usd: { type: "number", example: 929.0, description: "Preço convertido para dólar." },
    stock: { type: "integer", nullable: true, example: 20 },
    in_stock: { type: "boolean", example: true },
    url: { type: "string", nullable: true },
    image_url: { type: "string", nullable: true, description: "Imagem já otimizada pelo iCompras." },
    icompras_url: {
      type: "string",
      example: "https://icompras.com.py/pt-BR/produto/celular-apple-iphone-16-pro-128gb",
      description: "Página do produto no iCompras, onde a sua oferta aparece.",
    },
    category: { type: "string", nullable: true, description: "Categoria que o iCompras atribuiu." },
    stores_count: {
      type: "integer",
      example: 7,
      description: "Quantas lojas vendem este produto — a sua concorrência nele.",
    },
    updated_at: { type: "string", format: "date-time" },
  },
} as const;

export function documento(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "iCompras — API de Produtos",
      version: "1.0.0",
      description:
        "Envio de produtos e preços das lojas para o iCompras.\n\n" +
        "**Compatível com o formato do Compras Paraguai**: se a sua loja já envia produtos para lá, " +
        "o mesmo JSON funciona aqui. Troque apenas o endereço e o token.\n\n" +
        "**Moeda:** os preços são em **dólar (USD)**.\n\n" +
        "**Como enviar:**\n" +
        "- Mande apenas os produtos que mudaram desde o último envio bem-sucedido.\n" +
        "- Envie em lotes de até 500 produtos.\n" +
        "- `stock: 0` tira a oferta do site; ela volta sozinha quando você repuser.\n" +
        "- Se a sua loja não controla estoque, mande `stock` maior que zero sempre.",
    },
    servers: [{ url: baseUrl }],
    tags: [{ name: "products", description: "Produtos da loja" }],
    components: {
      securitySchemes: {
        tokenAuth: {
          type: "apiKey",
          in: "header",
          name: "token",
          description: "Chave da loja. Aceitamos também `Authorization: Bearer <chave>`.",
        },
      },
    },
    security: [{ tokenAuth: [] }],
    paths: {
      "/api/products/import/": {
        post: {
          operationId: "products_import_create",
          tags: ["products"],
          summary: "Insere/atualiza produtos da loja",
          description:
            "Aceita a lista no formato do Compras Paraguai (array de produtos) ou no formato " +
            "próprio do iCompras (`{\"items\": [...]}`).\n\n" +
            "A resposta é **207**: cada produto recusado volta com o motivo, para você corrigir " +
            "sem precisar adivinhar qual linha deu problema.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { type: "array", items: ItemJson },
                    { type: "object", properties: { items: { type: "array", items: ItemJson } }, required: ["items"] },
                  ],
                },
              },
            },
          },
          responses: {
            "207": {
              description: "Processado. Veja `products_failed` e `validation_errors`.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean", example: true },
                      message: { type: "string", example: "Importação concluída." },
                      products_processed: { type: "integer", example: 498 },
                      products_failed: { type: "integer", example: 2 },
                      validation_errors: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            product: { type: "object", description: "O produto como você o enviou." },
                            errors: { type: "array", items: { type: "string" } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { description: "Token ausente ou inválido." },
            "402": { description: "Assinatura vencida, cancelada ou inexistente." },
            "413": { description: "Lote maior que o permitido pelo seu plano." },
            "429": { description: "Limite diário de requisições atingido." },
          },
        },
      },
      "/api/products/list/": {
        get: {
          operationId: "products_list_retrieve",
          tags: ["products"],
          summary: "Lista os produtos da loja",
          description:
            "Devolve o que a sua loja enviou **e como o iCompras entendeu**: para qual produto foi " +
            "agrupado, que categoria recebeu, o preço em dólar e quantas lojas concorrem nele.",
          parameters: [
            { in: "query", name: "code", schema: { type: "string" }, description: "Filtra pelo seu código." },
            { in: "query", name: "name", schema: { type: "string" }, description: "Busca por parte do nome." },
            { in: "query", name: "with_stock", schema: { type: "boolean" }, description: "Só com estoque (true) ou só sem (false)." },
            { in: "query", name: "available", schema: { type: "boolean" }, description: "Só disponíveis (true) ou só indisponíveis (false)." },
            { in: "query", name: "page", schema: { type: "integer", default: 1 }, description: "Página (100 por página)." },
          ],
          responses: {
            "200": {
              description: "Lista paginada.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      count: { type: "integer", description: "Total de produtos da loja." },
                      page: { type: "integer" },
                      pages: { type: "integer" },
                      data: { type: "array", items: SaidaProduto },
                    },
                  },
                },
              },
            },
            "401": { description: "Token ausente ou inválido." },
          },
        },
      },
    },
  };
}

// Página do Swagger. O arquivo do Swagger vem de um CDN — é uma página de
// documentação, aberta por um humano no navegador, não algo de que o site
// dependa para funcionar.
export function paginaSwagger(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>iCompras — API de Produtos</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
<div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
<script>
window.onload = () => SwaggerUIBundle({ url: "/api/schema/", dom_id: "#swagger", deepLinking: true });
</script>
</body>
</html>`;
}
