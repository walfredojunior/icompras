import { z } from "zod";

// Contrato da lista de preços que a loja envia para a API.
export const PriceListItemSchema = z.object({
  external_id: z.string().max(200).optional(), // id do produto no sistema da loja
  name: z.string().min(1).max(300),
  brand: z.string().max(120).optional(),
  category: z.string().max(160).optional(), // slug de categoria (opcional)
  price: z.number().nonnegative(),
  // DÓLAR é o padrão da plataforma. As 278.209 ofertas do site estão em USD;
  // as outras moedas são convertidas pelo câmbio na ingestão.
  //
  // ⚠ Isto era `default("PYG")` até 05/08/2026 — resquício de quando o projeto
  // mirava paraguaios. Era uma bomba armada: loja que mandasse `price: 100` sem
  // informar a moeda teria o produto lido como 100 GUARANIS e publicado por
  // **US$ 0,01**. Nenhuma das redes de proteção do coletor pega isso, porque
  // elas ficam no caminho do coletor, não no da API.
  currency: z.string().length(3).default("USD"),
  url: z.string().url().max(600).optional(),
  image_url: z.string().url().max(500).optional(),
  in_stock: z.boolean().default(true),
  // Quantidade em estoque. Opcional: loja que não controla estoque não manda,
  // e o produto continua aparecendo. Mandando 0, a oferta sai do site — não
  // adianta anunciar o menor preço de algo que ninguém consegue comprar.
  stock: z.number().int().nonnegative().optional(),
  attributes: z.record(z.string(), z.string()).optional(), // { color: "Preto", storage: "128GB" }
});

export const PriceListSchema = z.object({
  items: z.array(PriceListItemSchema).min(1).max(5000),
});

export type PriceListItem = z.infer<typeof PriceListItemSchema>;
export type PriceList = z.infer<typeof PriceListSchema>;
