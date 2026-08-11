import { ExternalLink, HelpCircle } from "lucide-react";

// "Faz um help aí onde tá o link de cada servidor pra eu não esquecer" (11/08/2026).
//
// Os links de saldo e de chave já aparecem em cada seção da tela, mas soltos —
// servem para quem já sabe o caminho. Isto aqui é para o outro momento: o dia
// em que ele vai criar a conta pela primeira vez, ou seis meses depois, quando
// não lembra mais onde ficava o quê.
//
// Mesma ideia da página de Anotações: o que não está escrito, na hora H, custa
// meia hora de procura. E o dono é não-técnico — "gere uma API key" não é
// instrução, é jargão. Por isso o passo a passo é numerado e diz onde clicar.
//
// Fica fechado por padrão (`<details>`): quem usa todo dia não precisa ver.

interface Servico {
  chave: string;
  nome: string;
  paraQue: string;
  custo: string;
  passos: string[];
  links: Array<{ texto: string; url: string }>;
  aviso?: string;
}

const SERVICOS: Servico[] = [
  {
    chave: "deepseek",
    nome: "DeepSeek — descrições de produto",
    paraQue: "Escreve a descrição a partir do nome e da ficha do produto. É o mais barato dos três.",
    custo: "Pré-pago. Alguns dólares dão para milhares de descrições.",
    passos: [
      "Entre em platform.deepseek.com e crie a conta (dá para entrar com Google).",
      "No menu, vá em «API keys» e clique em «Create new API key».",
      "Copie a chave — ela só aparece UMA vez. Se fechar a janela, é preciso gerar outra.",
      "Cole no campo «Chave» da seção «Descrições de produto», aqui nesta tela.",
      "Adicione saldo em «Top up» — sem saldo, a API recusa e as descrições param.",
    ],
    links: [
      { texto: "Criar conta / entrar", url: "https://platform.deepseek.com" },
      { texto: "Gerar chave (API keys)", url: "https://platform.deepseek.com/api_keys" },
      { texto: "Ver saldo e uso", url: "https://platform.deepseek.com/usage" },
    ],
  },
  {
    chave: "fal",
    nome: "fal.ai — fotos geradas (FLUX)",
    paraQue: "Cria uma imagem a partir de um texto. É o provedor que já usamos no KaruGO-Chef.",
    custo: "Pré-pago, por imagem. Barato, mas some rápido se ficar solto.",
    passos: [
      "Entre em fal.ai e faça login (Google ou GitHub).",
      "Vá em «Dashboard» › «Keys» e clique em «Add key».",
      "Copie a chave e cole no campo «Chave fal.ai», na seção «Fotos geradas por IA».",
      "Ponha crédito em «Billing» › «Credits».",
    ],
    links: [
      { texto: "Criar conta / entrar", url: "https://fal.ai" },
      { texto: "Gerar chave", url: "https://fal.ai/dashboard/keys" },
      { texto: "Ver saldo / pôr crédito", url: "https://fal.ai/dashboard/usage-billing/credits" },
    ],
    aviso: "Se o saldo zerar, a conta é bloqueada e a API responde «Exhausted balance» — não é erro nosso.",
  },
  {
    chave: "openai",
    nome: "OpenAI — fotos geradas (GPT Image)",
    paraQue: "Alternativa ao fal.ai. Costuma sair mais caro por imagem.",
    custo: "Exige faturamento ativo na organização — não tem camada gratuita.",
    passos: [
      "Entre em platform.openai.com.",
      "Vá em «API keys» › «Create new secret key».",
      "Copie e cole no campo «Chave OpenAI», na seção «Fotos geradas por IA».",
      "Confirme que há forma de pagamento em «Billing», senão a chave não funciona.",
    ],
    links: [
      { texto: "Gerar chave", url: "https://platform.openai.com/api-keys" },
      { texto: "Faturamento", url: "https://platform.openai.com/settings/organization/billing/overview" },
      { texto: "Conta / organização", url: "https://platform.openai.com/settings/organization/general" },
    ],
  },
  {
    chave: "google-img",
    nome: "Google — fotos geradas (Nano Banana)",
    paraQue: "A terceira opção de geração de imagem.",
    custo: "Sem camada gratuita para imagem: o projeto precisa de faturamento ativo no Google Cloud.",
    passos: [
      "Entre em aistudio.google.com e crie a chave em «API keys».",
      "Cole no campo «Chave Google», na seção «Fotos geradas por IA».",
      "Ative faturamento no projeto, em console.cloud.google.com › «Billing».",
    ],
    links: [
      { texto: "Gerar chave (AI Studio)", url: "https://aistudio.google.com/api-keys" },
      { texto: "Faturamento (Cloud)", url: "https://console.cloud.google.com/billing" },
    ],
    aviso: "Os modelos «Imagen» antigos já não são oferecidos a contas novas.",
  },
  {
    chave: "google-busca",
    nome: "Google — busca de foto REAL na web",
    paraQue:
      "Procura a foto verdadeira do produto na internet. Vem ANTES da IA: foto real vale mais que foto bonita.",
    custo: "100 buscas por dia de graça. Acima disso é pago.",
    passos: [
      "Crie o mecanismo de busca em programmablesearchengine.google.com › «Adicionar».",
      "Marque «Pesquisar em toda a web» e ligue «Pesquisa de imagens».",
      "Copie o «ID do mecanismo» (parece a1b2c3d4e5f6g7h8i) e cole no campo «Mecanismo (cx)».",
      "Gere a chave em console.cloud.google.com, ativando a «Custom Search API».",
      "Cole no campo «Chave» da seção «Busca de foto real na web».",
    ],
    links: [
      { texto: "Criar o mecanismo (cx)", url: "https://programmablesearchengine.google.com/controlpanel/all" },
      { texto: "Ativar a API e gerar chave", url: "https://console.cloud.google.com/apis/library/customsearch.googleapis.com" },
    ],
    aviso: "São DUAS coisas diferentes: o «cx» identifica o mecanismo, a «chave» autoriza o uso. Precisa dos dois.",
  },
];

export function AjudaIa() {
  return (
    <details className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold text-slate-800">
        <HelpCircle className="h-4 w-4 text-brand-navy" />
        Onde conseguir cada chave (passo a passo)
      </summary>

      <p className="mt-3 text-sm text-slate-500">
        Cada serviço tem conta e cobrança próprias. Todos estão na conta{" "}
        <strong>walfredojunior@gmail.com</strong>. Nada aqui gasta nada enquanto o serviço estiver
        desligado.
      </p>

      <div className="mt-5 space-y-5">
        {SERVICOS.map((s) => (
          <section key={s.chave} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold text-slate-900">{s.nome}</h3>
            <p className="mt-1 text-sm text-slate-600">{s.paraQue}</p>
            <p className="mt-1 text-xs text-slate-500">
              <strong>Custo:</strong> {s.custo}
            </p>

            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {s.passos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>

            {s.aviso && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ {s.aviso}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {s.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {l.texto}
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-slate-400">
        A chave só aparece UMA vez no site do provedor — se perder, gere outra, não há como recuperar. E
        depois de colada aqui, ela fica cifrada no banco: nem esta tela mostra o valor de volta.
      </p>
    </details>
  );
}
