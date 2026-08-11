import { AlertTriangle, MessageCircle, TrendingDown, Store as StoreIcon } from "lucide-react";
import type { LojaLead } from "@/lib/leadsQuentes";

// Bloco no topo de Admin › Leads com as lojas que saíram (ou estão saindo) do
// concorrente. Ideia do dono em 11/08/2026 — ver lib/leadsQuentes.ts.
//
// O desenho é de FOLHA DE ABORDAGEM, não de relatório: o que ele precisa para
// pegar o telefone é o nome, a cidade, quanto a loja anunciava, a faixa de
// preço (para saber se é loja de perfume ou de celular) e o WhatsApp num
// toque. Número de linha e id não servem para nada nessa hora.

function Zap({ numero }: { numero: string | null }) {
  if (!numero) return <span className="text-xs text-slate-300">sem WhatsApp</span>;
  const limpo = numero.replace(/\D/g, "");
  return (
    <a
      href={`https://wa.me/${limpo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {numero}
    </a>
  );
}

function faixa(l: LojaLead) {
  if (l.menorUsd == null || l.maiorUsd == null) return "—";
  const f = (n: number) => `US$ ${Math.round(n).toLocaleString("pt-BR")}`;
  return l.menorUsd === l.maiorUsd ? f(l.menorUsd) : `${f(l.menorUsd)} a ${f(l.maiorUsd)}`;
}

function Tabela({ lojas, encolheu }: { lojas: LojaLead[]; encolheu: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-3">Loja</th>
            <th className="py-2 pr-3">Cidade</th>
            <th className="py-2 pr-3">{encolheu ? "Anunciava / tem hoje" : "Anunciava"}</th>
            <th className="py-2 pr-3">Faixa de preço</th>
            <th className="py-2 pr-3">Sem anunciar</th>
            <th className="py-2">Contato</th>
          </tr>
        </thead>
        <tbody>
          {lojas.map((l) => (
            <tr key={l.slug} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-3 font-medium text-slate-800">
                {l.nome}
                {l.site && (
                  <a
                    href={l.site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs font-normal text-slate-400 hover:text-brand-navy"
                  >
                    site
                  </a>
                )}
              </td>
              <td className="py-2 pr-3 text-slate-500">{l.cidade ?? "—"}</td>
              <td className="py-2 pr-3 text-slate-700">
                {encolheu ? (
                  <span>
                    {l.ofertas.toLocaleString("pt-BR")} →{" "}
                    <strong className="text-amber-700">{(l.aindaTem ?? 0).toLocaleString("pt-BR")}</strong>
                  </span>
                ) : (
                  `${l.ofertas.toLocaleString("pt-BR")} ofertas`
                )}
              </td>
              <td className="py-2 pr-3 text-slate-500">{faixa(l)}</td>
              <td className="py-2 pr-3 text-slate-500">{l.dias} dias</td>
              <td className="py-2">
                <Zap numero={l.whatsapp} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LeadsQuentes({
  sairam,
  encolheram,
  observacao,
  aviso,
}: {
  sairam: LojaLead[];
  encolheram: LojaLead[];
  observacao: LojaLead[];
  aviso: string | null;
}) {
  // Trava: leitura suspeita mostra o AVISO no lugar das listas. Mandar ele
  // ligar para lojas que nunca saíram queima o trabalho dele e a confiança na
  // tela. Ver `leituraConfiavel`.
  if (aviso) {
    return (
      <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          Lista suspensa
        </p>
        <p className="mt-1 text-sm text-amber-800">{aviso}</p>
        <p className="mt-2 text-xs text-amber-700">
          Nada aqui foi apagado — a lista volta sozinha quando a coleta normalizar.
        </p>
      </div>
    );
  }

  if (!sairam.length && !encolheram.length && !observacao.length) return null;

  return (
    <div className="mb-8 space-y-6">
      {sairam.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <StoreIcon className="h-4 w-4 text-brand-navy" />
            Pararam de anunciar no concorrente
            <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-xs font-medium text-brand-navy">
              {sairam.length}
            </span>
          </h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            Sem nenhuma oferta há mais de duas semanas. É a hora de oferecer — mas confirme antes se a
            loja continua funcionando: quem some de vez às vezes fechou as portas.
          </p>
          <Tabela lojas={sairam} encolheu={false} />
        </section>
      )}

      {encolheram.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <TrendingDown className="h-4 w-4 text-amber-600" />
            Cortaram a maior parte do catálogo
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {encolheram.length}
            </span>
          </h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            Continuam anunciando, mas com menos de um terço do que tinham. Costuma ser o melhor lead da
            tela: estão cortando gasto com o concorrente e seguem ativas e atendendo o telefone.
          </p>
          <Tabela lojas={encolheram} encolheu={true} />
        </section>
      )}

      {/* EM OBSERVAÇÃO. Separadas de propósito: 14 dias é um prazo escolhido
          por segurança, não uma verdade. Uma loja parada há 12 dias
          provavelmente saiu mesmo — mas apresentá-la com a mesma confiança das
          confirmadas é o caminho para você ligar oferecendo desconto a quem
          nunca saiu. Ficam à vista, com o rótulo certo. */}
      {observacao.length > 0 && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            Em observação
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
              {observacao.length}
            </span>
          </h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">
            Entre 7 e 14 dias sem anunciar. Ainda pode ser só demora nossa em revisitar — a volta do
            coletor às vezes passa de uma semana. Sobem para a lista de cima se continuarem sumidas.
          </p>
          <Tabela lojas={observacao} encolheu={false} />
        </section>
      )}
    </div>
  );
}
