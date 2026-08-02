import { z } from "zod";

// Contrato da lista de preços que a loja envia para a API.
export const PriceListItemSchema = z.object({
  external_id: z.string().max(200).optional(), // id do produto no sistema da loja
  name: z.string().min(1).max(300),
  brand: z.string().max(120).optional(),
  category: z.string().max(160).optional(), // slug de categoria (opcional)
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("PYG"),
  url: z.string().url().max(600).optional(),
  image_url: z.string().url().max(500).optional(),
  in_stock: z.boolean().default(true),
  attributes: z.record(z.string(), z.string()).optional(), // { color: "Preto", storage: "128GB" }
});

export const PriceListSchema = z.object({
  items: z.array(PriceListItemSchema).min(1).max(5000),
});

export type PriceListItem = z.infer<typeof PriceListItemSchema>;
export type PriceList = z.infer<typeof PriceListSchema>;
