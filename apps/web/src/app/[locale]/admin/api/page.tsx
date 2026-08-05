import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";
import { SITE_URL } from "@/lib/seo";
import LinkDoManual from "@/components/LinkDoManual";

// ESTA PÁGINA JÁ MENTIU — e mentiu por dez dias.
//
// Até 05/08/2026 ela descrevia o endereço antigo (`/v1/price-list`), campos que
// o formato novo não tem (`currency`, `in_stock`, `attributes`) e, pior, dizia
// "Moeda. Padrão: PYG" — o mesmo engano que o dono corrigiu no código em 05/08
// ("nosso padrão também é dólar"). Uma loja que seguisse esta tela mandaria
// preço em guarani achando que era obrigatório.
//
// Por isso o conteúdo de verdade agora é o manual GERADO do código
// (`/api/schema/swagger-ui/`, montado por apps/api/src/openapi.ts a partir do
// mesmo esquema que valida os dados). Esta tela ficou com o papel de:
//   1. entregar o link pronto para mandar para a loja — foi o que ele pediu;
//   2. explicar o passo que o manual técnico não cobre: onde nasce a chave.
// O resumo abaixo é curto de propósito. Detalhe que mora aqui volta a envelhecer.

const MANUAL = `${SITE_URL}/api/schema/swagger-ui/`;

export default async function AdminApiDocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const pre = "overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100";
  const card = "rounded-2xl border border-slate-200 bg-white p-5";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-bold text-slate-900">API — Envio de produtos e preços</h1>
        <p className="text-sm text-slate-500">
          O manual completo fica online e é público: mande o link para a loja e ela se vira sozinha.
        </p>
      </div>

      <div className="rounded-2xl border border-brand-navy/15 bg-brand-navy/5 p-5">
        <h2 className="mb-1 font-semibold text-slate-900">Manual online para enviar à loja</h2>
        <p className="mb-4 text-sm text-slate-600">
          Página pronta, com todos os campos e um botão de testar. Não precisa de senha — pode mandar por
          WhatsApp, e-mail ou colar num contrato.
        </p>
        <LinkDoManual url={MANUAL} />
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">1. Gere a chave da loja</h2>
        <p className="text-sm text-slate-600">
          Em <strong>Admin › Clientes › (loja) › Chave de API</strong>, clique em <em>Gerar chave</em>. A chave (começa
          com <code className="mx-1 rounded bg-slate-100 px-1">ic_</code>) aparece <strong>uma única vez</strong> — copie
          e entregue à loja. Ela é secreta, como uma senha.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          É a única coisa que o manual online não pode dizer, porque é diferente para cada loja.
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">2. O resumo, para você conferir</h2>
        <p className="mb-3 text-sm text-slate-600">
          O formato é o <strong>mesmo do Compras Paraguai</strong>. Quem já envia para lá troca só o endereço e o token —
          esse é o argumento de venda.
        </p>
        <div className={pre}>
          <span className="text-brand-green">POST</span> {SITE_URL}/api/products/import/{"\n"}
          token: ic_suachavesecreta
        </div>
        <div className={`${pre} mt-3`}>
          <pre>{`[
  {
    "code": "SKU-123",
    "name": "Celular Apple iPhone 16 Pro 128GB",
    "price": 929.00,
    "stock": 12,
    "brand": "Apple",
    "link": "https://sualoja.com.py/iphone-16-pro",
    "url_image": "https://sualoja.com.py/img/iphone.jpg"
  }
]`}</pre>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="pb-1 pr-4">Campo</th>
                <th className="pb-1 pr-4"></th>
                <th className="pb-1">O que é</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["code", true, "O código do produto na loja. É por ele que a oferta é atualizada em vez de duplicada."],
                  ["name", true, "Nome do produto."],
                  ["price", true, "Preço em DÓLAR. Sempre."],
                  ["stock", true, "Quantidade. Zero tira a oferta do site; ela volta sozinha quando repuser."],
                  ["brand", false, "Marca."],
                  ["link", false, "Endereço do produto no site da loja."],
                  ["url_image", false, "Endereço da foto."],
                  ["description", false, "Descrição."],
                ] as Array<[string, boolean, string]>
              ).map(([nome, obrigatorio, desc]) => (
                <tr key={nome} className="border-t border-slate-50">
                  <td className="py-2 pr-4">
                    <code className="rounded bg-slate-100 px-1 text-brand-navy">{nome}</code>
                  </td>
                  <td className="py-2 pr-4">
                    {obrigatorio ? (
                      <span className="text-red-600">obrigatório</span>
                    ) : (
                      <span className="text-slate-400">opcional</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-600">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          A lista completa — incluindo os campos que aceitamos só para não recusar quem já os manda
          (<code>price_iva</code>, <code>link_purchase</code>, <code>force_image_update</code>) — está no manual online, que
          é gerado do próprio código e por isso nunca fica desatualizado.
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">3. O que a loja recebe de volta</h2>
        <div className={pre}>
          <span className="text-brand-green">207 Multi-Status</span>
          {"\n"}
          {`{ "success": true, "message": "Importação concluída.",
  "products_processed": 1, "products_failed": 0,
  "validation_errors": [] }`}
        </div>
        <p className="mt-3 text-sm text-slate-600">Quando dá errado:</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {(
                [
                  ["400", "JSON fora do formato, ou lista vazia."],
                  ["401", "Chave ausente, inválida ou revogada."],
                  ["402", "Assinatura vencida ou cancelada."],
                  ["413", "Mais produtos que o limite do plano."],
                  ["429", "Limite diário de envios atingido."],
                ] as Array<[string, string]>
              ).map(([codigo, desc]) => (
                <tr key={codigo} className="border-t border-slate-50">
                  <td className="py-2 pr-4">
                    <code>{codigo}</code>
                  </td>
                  <td className="py-2 text-slate-600">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          O <code>207</code> vem mesmo quando tudo deu certo: é o que o cliente do Compras Paraguai já espera.
          Produto recusado não derruba o lote — os aceitos entram e os problemas voltam em{" "}
          <code>validation_errors</code>.
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">Bom saber</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Mande só os produtos que mudaram, em lotes de até 500.</li>
          <li>Assim que a loja envia pela API, o iCompras para de coletar os preços dela — ela passa a mandar no próprio catálogo.</li>
          <li>Os limites de produtos e de envios por dia vêm do plano, em <strong>Admin › Planos</strong>.</li>
          <li>
            O endereço antigo <code className="rounded bg-slate-100 px-1">/v1/price-list</code> continua funcionando para
            quem já usa, mas o indicado para loja nova é o de cima.
          </li>
        </ul>
      </div>
    </div>
  );
}
