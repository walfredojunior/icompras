import { z } from "zod";
import type { PriceListItem } from "@icompras/core";

// COMPATIBILIDADE COM O FORMATO DO COMPRAS PARAGUAI
//
// Por que isto existe: a loja que já manda produtos para o comprasparaguai tem
// um programa pronto que monta um JSON no formato deles. Aceitando esse mesmo
// JSON, migrar para o iCompras deixa de ser um projeto de programação e vira
// trocar DUAS coisas: o endereço e o token. É o argumento de venda mais forte
// que temos com quem já está lá.
//
// Formato de referência: https://products.comprasparaguai.com.br/api/schema/
// (lido em 05/08/2026). Eles evoluem SOMANDO campos opcionais — `price_iva` e
// `force_image_update` entraram assim —, nunca mudando os que já existem,
// porque isso quebraria todos os clientes deles. Então esta compatibilidade
// envelhece bem.

// Texto em português e espanhol. Só o português é exigido, como no original.
const Traduzido = z.object({
  pt: z.string().min(1),
  es: z.string().optional(),
});

// Aceita tanto o objeto {pt, es} quanto uma string solta — algumas lojas
// simplificam, e recusar por isso seria implicância.
const TextoOuTraduzido = z.union([Traduzido, z.string().min(1)]);

/**
 * Endereço da web — e só isso.
 *
 * Antes destes campos serem `z.string()` puro, `javascript:alert(1)` e
 * `file:///etc/passwd` passavam pela validação e iam para o banco. Hoje o site
 * nunca põe esses valores direto num link (todo clique passa pelo nosso
 * `/ir/loja/`, que decide o destino a partir do banco), então não dava para
 * explorar — mas era uma mina esperando alguém escrever `href={oferta.url}`
 * num arquivo novo. Barrar na porta custa uma linha; lembrar para sempre de
 * não usar o campo, não.
 *
 * `.trim()` antes: espaço no começo é o disfarce mais banal (" javascript:").
 *
 * ⚠ Isto NÃO substitui a portaria de `packages/core/src/media/seguranca.ts`.
 * Aqui só se confere a forma do endereço; lá se confere PARA ONDE ele aponta,
 * o que só dá para saber na hora de buscar.
 */
const EnderecoWeb = (max: number) =>
  z
    .string()
    .max(max)
    .trim()
    .refine((v) => v === "" || /^https?:\/\//i.test(v), {
      message: "Deve começar com http:// ou https://",
    });

export const ItemCompatSchema = z.object({
  code: z.string().min(1).max(200),
  name: TextoOuTraduzido,
  price: z.number().nonnegative(),
  stock: z.number().nonnegative(),
  description: TextoOuTraduzido.optional(),
  url_image: EnderecoWeb(500).optional(),
  link: EnderecoWeb(600).optional(),
  brand: z.string().max(120).nullable().optional(),

  // Campos aceitos para não recusar quem já os envia, mas que o iCompras não
  // usa hoje:
  //  · price_iva — preço com IVA, para venda a paraguaio. O iCompras é para
  //    BRASILEIROS, que não pagam IVA (decisão do dono, 05/08/2026).
  //  · link_purchase — o clique do visitante vai para a página do produto
  //    (`link`), que é onde ele compara antes de decidir.
  //  · force_image_update — nossa imagem é reprocessada quando a URL muda.
  price_iva: z.number().nullable().optional(),
  link_purchase: EnderecoWeb(600).optional(),
  force_image_update: z.boolean().optional(),
});

// O corpo pode vir como array puro (formato deles) ou como {items:[...]}
// (o nosso). Os dois funcionam no mesmo endereço.
export const CorpoCompatSchema = z.union([
  z.array(ItemCompatSchema),
  z.object({ items: z.array(ItemCompatSchema) }),
]);

export type ItemCompat = z.infer<typeof ItemCompatSchema>;

const texto = (v: z.infer<typeof TextoOuTraduzido> | undefined): string =>
  v === undefined ? "" : typeof v === "string" ? v : v.pt;

// Traduz um item do formato deles para o nosso.
export function paraNosso(item: ItemCompat): PriceListItem {
  return {
    external_id: item.code,
    name: texto(item.name).slice(0, 300),
    brand: item.brand?.slice(0, 120) || undefined,
    price: item.price,
    // Eles não têm campo de moeda porque trabalham em dólar — e o iCompras
    // também. Deixar implícito aqui seria pedir para alguém errar por 7 mil
    // vezes, então vai explícito.
    currency: "USD",
    url: item.link || undefined,
    image_url: item.url_image || undefined,
    stock: item.stock,
    // `stock: 0` tira a oferta do site. Sem o campo, a loja é tratada como
    // disponível (ver o schema em core) — quem não controla estoque não pode
    // sumir do site por engano.
    in_stock: item.stock > 0,
  };
}

// Erro de um item, no formato que eles devolvem: o produto inteiro de volta,
// para a loja saber exatamente qual linha do arquivo dela deu problema.
export interface ErroItem {
  product: unknown;
  errors: string[];
}

export interface ResultadoImport {
  success: boolean;
  message: string;
  products_processed: number;
  products_failed: number;
  validation_errors: ErroItem[];
}

// Valida item a item e separa os bons dos ruins.
//
// A diferença que mais importa em relação ao nosso endpoint antigo: ele
// respondia só "recebido". Uma loja podia mandar metade do catálogo com erro e
// descobrir semanas depois. Aqui cada item recusado volta com o motivo.
export function validarLote(corpo: unknown): {
  ok: ItemCompat[];
  erros: ErroItem[];
  formatoInvalido?: string;
} {
  const bruto = Array.isArray(corpo)
    ? corpo
    : corpo && typeof corpo === "object" && Array.isArray((corpo as { items?: unknown }).items)
      ? ((corpo as { items: unknown[] }).items)
      : null;

  if (!bruto) {
    return {
      ok: [],
      erros: [],
      formatoInvalido:
        "Envie uma lista de produtos (array JSON) ou um objeto no formato {\"items\": [...]}.",
    };
  }

  const ok: ItemCompat[] = [];
  const erros: ErroItem[] = [];
  for (const linha of bruto) {
    const r = ItemCompatSchema.safeParse(linha);
    if (r.success) ok.push(r.data);
    else {
      erros.push({
        product: linha,
        errors: r.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`),
      });
    }
  }
  return { ok, erros };
}
