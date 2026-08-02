import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/adminauth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://SEU-SERVIDOR:3001";

const curlExample = `curl -X POST ${API_URL}/v1/price-list \\
  -H "Authorization: Bearer ic_suachavesecreta" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      {
        "external_id": "SKU-123",
        "name": "Apple iPhone 17 Pro 256GB",
        "brand": "Apple",
        "price": 1219.00,
        "currency": "USD",
        "url": "https://sualoja.com/iphone-17-pro",
        "image_url": "https://sualoja.com/img/iphone.jpg",
        "in_stock": true,
        "attributes": { "color": "Preto", "storage": "256GB" }
      }
    ]
  }'`;

const jsonExample = `{
  "items": [
    { "name": "Produto A", "price": 99.90, "currency": "USD" },
    { "name": "Produto B", "price": 149.00, "currency": "USD", "brand": "Samsung" }
  ]
}`;

function Field({ name, type, req, desc }: { name: string; type: string; req?: boolean; desc: string }) {
  return (
    <tr className="border-t border-slate-50">
      <td className="py-2 pr-4"><code className="rounded bg-slate-100 px-1 text-brand-navy">{name}</code></td>
      <td className="py-2 pr-4 text-slate-500">{type}</td>
      <td className="py-2 pr-4">{req ? <span className="text-red-600">obrigatório</span> : <span className="text-slate-400">opcional</span>}</td>
      <td className="py-2 text-slate-600">{desc}</td>
    </tr>
  );
}

export default async function AdminApiDocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await getCurrentAdmin())) redirect(`/${locale}/admin/entrar`);

  const pre = "overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100";
  const card = "rounded-2xl border border-slate-200 bg-white p-5";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-bold text-slate-900">API — Envio da lista de preços</h1>
        <p className="text-sm text-slate-500">Manual para as lojas integrarem e enviarem seus preços ao iCompras.</p>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">1. Pegue a chave de API</h2>
        <p className="text-sm text-slate-600">
          Em <strong>Admin › Clientes › (loja) › Chave de API</strong>, clique em <em>Gerar chave</em>. A chave (começa com
          <code className="mx-1 rounded bg-slate-100 px-1">ic_</code>) aparece <strong>uma única vez</strong> — copie e entregue à loja.
          Ela é secreta, como uma senha.
        </p>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">2. Endpoint</h2>
        <div className={pre}>
          <span className="text-brand-green">POST</span> {API_URL}/v1/price-list
        </div>
        <p className="mt-2 text-xs text-slate-400">Em produção, troque pelo endereço público da sua API.</p>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">3. Cabeçalhos</h2>
        <div className={pre}>
          Authorization: Bearer ic_suachavesecreta{"\n"}
          Content-Type: application/json
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">4. Corpo (JSON)</h2>
        <p className="mb-3 text-sm text-slate-600">Um objeto com <code className="rounded bg-slate-100 px-1">items</code> (lista de produtos, de 1 a 5000):</p>
        <div className={pre}>
          <pre>{jsonExample}</pre>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400">
              <tr><th className="pb-1 pr-4">Campo</th><th className="pb-1 pr-4">Tipo</th><th className="pb-1 pr-4"></th><th className="pb-1">Descrição</th></tr>
            </thead>
            <tbody>
              <Field name="name" type="texto" req desc="Nome do produto." />
              <Field name="price" type="número" req desc="Preço (ex.: 1219.00)." />
              <Field name="currency" type="texto(3)" desc="Moeda: USD, PYG, BRL. Padrão: PYG." />
              <Field name="external_id" type="texto" desc="ID/SKU do produto no sistema da loja (ajuda a atualizar)." />
              <Field name="brand" type="texto" desc="Marca." />
              <Field name="category" type="texto" desc="Slug da categoria (opcional)." />
              <Field name="url" type="URL" desc="Link do produto na loja." />
              <Field name="image_url" type="URL" desc="Link da imagem." />
              <Field name="in_stock" type="booleano" desc="true/false. Padrão: true." />
              <Field name="attributes" type="objeto" desc='Variações, ex.: { "color": "Preto", "storage": "256GB" }.' />
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">5. Exemplo completo (curl)</h2>
        <div className={pre}>
          <pre>{curlExample}</pre>
        </div>
        <p className="mt-3 text-sm text-slate-600">Resposta de sucesso:</p>
        <div className={pre}>
          <span className="text-brand-green">202 Accepted</span>{"\n"}
          {`{ "accepted": true, "jobId": "123", "received": 1 }`}
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">6. Erros possíveis</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-400">
              <tr><th className="pb-1 pr-4">Código</th><th className="pb-1">Significado</th></tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-50"><td className="py-2 pr-4"><code>400</code></td><td className="py-2 text-slate-600">Payload inválido (falta nome/preço, formato errado).</td></tr>
              <tr className="border-t border-slate-50"><td className="py-2 pr-4"><code>401</code></td><td className="py-2 text-slate-600">Chave ausente, inválida ou revogada.</td></tr>
              <tr className="border-t border-slate-50"><td className="py-2 pr-4"><code>402</code></td><td className="py-2 text-slate-600">Assinatura vencida ou cancelada — regularizar pagamento.</td></tr>
              <tr className="border-t border-slate-50"><td className="py-2 pr-4"><code>413</code></td><td className="py-2 text-slate-600">Mais produtos que o limite do plano — fazer upgrade.</td></tr>
              <tr className="border-t border-slate-50"><td className="py-2 pr-4"><code>429</code></td><td className="py-2 text-slate-600">Limite diário de requisições atingido.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className={card}>
        <h2 className="mb-2 font-semibold text-slate-900">Dicas</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Envie a lista completa periodicamente (ex.: a cada 30–60 min). Produtos com o mesmo <code className="rounded bg-slate-100 px-1">external_id</code> são atualizados.</li>
          <li>Assim que a loja começa a enviar pela API, o iCompras para de raspar os preços dela (ela gerencia o próprio feed).</li>
          <li>Os limites (produtos e requisições/dia) vêm do plano — dá para ajustar em <strong>Admin › Planos</strong>.</li>
        </ul>
      </div>
    </div>
  );
}
